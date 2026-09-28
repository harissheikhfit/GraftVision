import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const migrationFilePattern =
  /^(?<timestamp>\d{14})_(?<description>[a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.sql$/u;

const ambiguousDescriptions = new Set([
  "change",
  "changes",
  "fix",
  "migration",
  "schema",
  "temp",
  "test",
  "update",
]);

const dangerousSqlPatterns = [
  [/\bdrop\s+table\b/iu, "DROP TABLE"],
  [/\bdrop\s+column\b/iu, "DROP COLUMN"],
  [/\btruncate(?:\s+table)?\b/iu, "TRUNCATE"],
  [/\bdisable\s+row\s+level\s+security\b/iu, "DISABLE ROW LEVEL SECURITY"],
  [/\balter\s+table\b[\s\S]*?\bdisable\b/iu, "ALTER TABLE ... DISABLE"],
  [/\bdelete\s+from\b/iu, "DELETE"],
  [/\bupdate\s+(?!policy\b)[a-z_"][\w".]*\s+set\b/iu, "UPDATE"],
  [/\busing\s*\(\s*true\s*\)/iu, "broad USING (true) policy"],
];

const dangerousAnnotationPatterns = [
  /^--\s*graftvision:dangerous-sql-approved\s+task=[A-Z][A-Z0-9-]*-\d+\s*$/mu,
  /^--\s*graftvision:dangerous-sql-reason\s+\S.+$/mu,
  /^--\s*graftvision:corrective-plan\s+\S.+$/mu,
];

const credentialPatterns = [
  [/\bpostgres(?:ql)?:\/\/[^\s'"]+/iu, "database connection string"],
  [/\b(?:service_role|secret|access)_key\s*[:=]\s*['"][^'"]+['"]/iu, "credential"],
  [/\b(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/iu, "password"],
  [
    /\bSUPABASE_(?:ACCESS_TOKEN|PROJECT_REF|SECRET_KEY|SERVICE_ROLE_KEY|URL)\s*=/u,
    "provider configuration",
  ],
];

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function formatUtcTimestamp(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required to create a migration timestamp.");
  }

  return date.toISOString().replace(/\D/gu, "").slice(0, 14);
}

export function validateMigrationDescription(description) {
  if (typeof description !== "string" || description.length === 0) {
    throw new Error("Provide one lowercase snake_case migration description.");
  }

  if (description.length > 80) {
    throw new Error("Migration descriptions must be 80 characters or fewer.");
  }

  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(description)) {
    throw new Error(
      `"${description}" is invalid; use lowercase snake_case beginning with a letter.`,
    );
  }

  if (ambiguousDescriptions.has(description)) {
    throw new Error(`"${description}" is too ambiguous; describe the logical change.`);
  }

  return description;
}

export function migrationTemplate({ description, timestamp }) {
  return `-- GraftVision migration
-- Task: REPLACE_WITH_APPROVED_TASK_ID
-- Purpose: ${description.replaceAll("_", " ")}
-- Created UTC: ${timestamp}
-- Category: REPLACE_WITH_REVIEWED_CATEGORY
-- Compatibility: REPLACE_WITH_EXPAND_AND_CONTRACT_NOTES
-- Transaction and locks: REPLACE_WITH_REVIEW_NOTES
-- Tenant and RLS impact: REPLACE_WITH_REVIEW_NOTES
-- Data impact: REPLACE_WITH_REVIEW_NOTES
-- Verification: REPLACE_WITH_TEST_EVIDENCE
-- Corrective plan: REPLACE_WITH_FORWARD_FIX_OR_RESTORE_PLAN
--
-- Add reviewed PostgreSQL SQL below. Never add credentials or real patient/clinic data.
`;
}

export async function createMigration({ description, directory, now = new Date() }) {
  const validDescription = validateMigrationDescription(description);
  const timestamp = formatUtcTimestamp(now);
  const entries = await readdir(directory, { withFileTypes: true });
  const timestampPrefix = `${timestamp}_`;

  if (entries.some((entry) => entry.isFile() && entry.name.startsWith(timestampPrefix))) {
    throw new Error(
      `Migration timestamp ${timestamp} already exists; wait for a later UTC second and retry.`,
    );
  }

  const filename = `${timestamp}_${validDescription}.sql`;
  const destination = path.join(directory, filename);

  try {
    await access(destination);
    throw new Error(`Migration "${filename}" already exists.`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(destination, migrationTemplate({ description: validDescription, timestamp }), {
    encoding: "utf8",
    flag: "wx",
  });

  return { destination, filename, timestamp };
}

function stripSqlComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--[^\r\n]*/gu, "")
    .trim();
}

export function inspectMigrationSource(source, sourceName) {
  const issues = [];

  if (stripSqlComments(source).length === 0) {
    issues.push(`${sourceName}: migration is empty or contains comments only.`);
  }

  for (const [pattern, description] of credentialPatterns) {
    if (pattern.test(source)) {
      issues.push(`${sourceName}: possible ${description} is prohibited.`);
    }
  }

  const dangerousStatements = dangerousSqlPatterns
    .filter(([pattern]) => pattern.test(source))
    .map(([, description]) => description);

  if (
    dangerousStatements.length > 0 &&
    !dangerousAnnotationPatterns.every((pattern) => pattern.test(source))
  ) {
    issues.push(
      `${sourceName}: ${dangerousStatements.join(", ")} requires all reviewed dangerous-SQL annotations.`,
    );
  }

  return issues;
}

export async function inspectMigrationDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const issues = [];
  const migrationFiles = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      issues.push(`${entry.name}: nested migration directories are prohibited.`);
      continue;
    }

    if (entry.name === ".gitkeep" || entry.name === "checksums.sha256") {
      continue;
    }

    if (!entry.name.endsWith(".sql")) {
      issues.push(
        `${entry.name}: only .sql migrations, .gitkeep, and checksums.sha256 are allowed.`,
      );
      continue;
    }

    const match = migrationFilePattern.exec(entry.name);

    if (!match?.groups) {
      issues.push(
        `${entry.name}: expected YYYYMMDDHHMMSS_descriptive_name.sql with lowercase snake_case.`,
      );
      continue;
    }

    try {
      validateMigrationDescription(match.groups.description);
    } catch (error) {
      issues.push(`${entry.name}: ${error.message}`);
    }

    migrationFiles.push({
      filename: entry.name,
      timestamp: match.groups.timestamp,
    });
  }

  const orderedMigrations = migrationFiles.toSorted((left, right) =>
    left.filename.localeCompare(right.filename),
  );
  const observedTimestamps = new Set();
  let previousTimestamp = "";

  for (const migration of orderedMigrations) {
    if (observedTimestamps.has(migration.timestamp)) {
      issues.push(`${migration.filename}: duplicate UTC timestamp ${migration.timestamp}.`);
    }

    if (previousTimestamp && migration.timestamp <= previousTimestamp) {
      issues.push(`${migration.filename}: migration timestamps must increase deterministically.`);
    }

    observedTimestamps.add(migration.timestamp);
    previousTimestamp = migration.timestamp;
    const source = await readFile(path.join(directory, migration.filename), "utf8");
    issues.push(...inspectMigrationSource(source, migration.filename));
  }

  return {
    issues,
    migrations: orderedMigrations.map(({ filename }) => filename),
  };
}

export function formatMigrationIssues(issues, directory) {
  return [
    `Migration policy failed for ${normalisePath(directory)}:`,
    ...issues.map((issue) => `  - ${issue}`),
  ].join("\n");
}
