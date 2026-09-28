import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatMigrationIssues, inspectMigrationDirectory } from "./migration-policy.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDirectory = path.join(rootDirectory, "supabase");
const migrationsDirectory = path.join(databaseDirectory, "migrations");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision migration policy verifier

Usage:
  corepack pnpm verify:migration-policy

Checks the migration guide and directory contract, deterministic migration filenames,
duplicate/order errors, empty migrations, obvious dangerous SQL annotations, and
the local-only provider configuration. It does not parse or execute SQL.`);
  process.exit(0);
}

const guide = await readFile(path.join(databaseDirectory, "README.md"), "utf8");

for (const requiredText of [
  "SQL migrations are the schema source of truth",
  "YYYYMMDDHHMMSS_descriptive_name.sql",
  "Local workflow",
  "Staging workflow",
  "Production workflow",
  "Expand-and-contract",
  "Destructive changes and rollback",
  "Data migrations",
  "RLS and security-definer changes",
  "Drift, snapshots, checksums, and audit",
  "TENANT-001",
  "tenant_isolation.test.sql",
]) {
  assert(
    guide.toLowerCase().includes(requiredText.toLowerCase()),
    `supabase/README.md must document "${requiredText}".`,
  );
}

for (const relativeDirectory of ["migrations", "seed", "tests/database"]) {
  await access(path.join(databaseDirectory, relativeDirectory));
}

await access(path.join(databaseDirectory, "config.toml"));

for (const prohibitedPath of ["seed.sql"]) {
  try {
    await access(path.join(databaseDirectory, prohibitedPath));
    assert.fail(`supabase/${prohibitedPath} is outside TENANT-001 scope.`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

const result = await inspectMigrationDirectory(migrationsDirectory);

if (result.issues.length > 0) {
  throw new Error(formatMigrationIssues(result.issues, "supabase/migrations"));
}

assert.equal(
  result.migrations.length,
  96,
  "The current tenant, audit, session, RBAC, authorization, clinic, patient, platform-admin, consultation, scan, reconstruction, planning, AI-map, and scalp-region foundations must contain exactly ninety-six additive migrations.",
);

console.log(
  `Migration policy passed: ${result.migrations.length} ordered SQL migration(s); ` +
    "directory, naming, review, dangerous-SQL, and local-only provider rules are valid.",
);
