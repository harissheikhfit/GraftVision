import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createMigration,
  inspectMigrationDirectory,
  inspectMigrationSource,
  validateMigrationDescription,
} from "./migration-policy.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "graftvision-migration-fixtures-"));

try {
  for (const invalidName of [
    "Update",
    "changes",
    "contains spaces",
    "camelCase",
    "1_starts_with_number",
    "trailing_",
  ]) {
    assert.throws(
      () => validateMigrationDescription(invalidName),
      undefined,
      `${invalidName} must be rejected.`,
    );
  }

  const validName = validateMigrationDescription("add_reviewed_constraint");
  assert.equal(validName, "add_reviewed_constraint");

  const creationDirectory = path.join(temporaryDirectory, "creation");
  await mkdir(creationDirectory);
  const fixedDate = new Date("2026-07-26T12:00:00.000Z");
  const created = await createMigration({
    description: "add_reviewed_constraint",
    directory: creationDirectory,
    now: fixedDate,
  });
  assert.equal(created.filename, "20260726120000_add_reviewed_constraint.sql");

  await assert.rejects(
    createMigration({
      description: "add_another_constraint",
      directory: creationDirectory,
      now: fixedDate,
    }),
    /timestamp .* already exists/iu,
  );

  const duplicateDirectory = path.join(temporaryDirectory, "duplicate");
  await mkdir(duplicateDirectory);
  await Promise.all([
    writeFile(path.join(duplicateDirectory, "20260726120000_first_change.sql"), "select 1;\n"),
    writeFile(path.join(duplicateDirectory, "20260726120000_second_change.sql"), "select 2;\n"),
  ]);
  const duplicateResult = await inspectMigrationDirectory(duplicateDirectory);
  assert(duplicateResult.issues.some((issue) => issue.includes("duplicate UTC timestamp")));

  const unsafeSource = "drop table future_fixture;\n";
  assert(
    inspectMigrationSource(unsafeSource, "unsafe.sql").some((issue) =>
      issue.includes("requires all reviewed dangerous-SQL annotations"),
    ),
  );

  const reviewedSource = `-- graftvision:dangerous-sql-approved task=DB-999
-- graftvision:dangerous-sql-reason synthetic_fixture_only
-- graftvision:corrective-plan recreate_synthetic_fixture
drop table future_fixture;
`;
  assert.deepEqual(inspectMigrationSource(reviewedSource, "reviewed.sql"), []);
  assert(
    inspectMigrationSource("-- comments only\n", "placeholder.sql").some((issue) =>
      issue.includes("comments only"),
    ),
  );

  console.log(
    "Migration fixtures passed: valid creation, invalid names, timestamp collision, " +
      "duplicate timestamp, placeholder, and dangerous-SQL annotation cases behave safely.",
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
