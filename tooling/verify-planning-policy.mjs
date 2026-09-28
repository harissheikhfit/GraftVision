import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(rootDirectory, "supabase", "migrations");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision Planning policy verifier

Usage:
  corepack pnpm verify:planning-policy

Ensures planning tables exist and enforce draft -> calculated -> finalized transitions.`);
  process.exit(0);
}

let allSql = "";
const files = await readdir(migrationsDirectory);
for (const file of files.sort()) {
  if (file.endsWith(".sql")) {
    allSql += (await readFile(path.join(migrationsDirectory, file), "utf8")) + "\n";
  }
}

assert.match(allSql, /create table public\.planning_package/iu, "Missing planning_package table");
assert.match(
  allSql,
  /package_state text not null default 'draft' check \(package_state in \('draft', 'calculated', 'finalized', 'superseded', 'stale'\)\)/iu,
  "Missing exact state transitions for planning packages",
);
assert.match(
  allSql,
  /create table public\.planning_idempotency/iu,
  "Missing planning_idempotency table",
);

assert.match(
  allSql,
  /create or replace function graftvision_private\.finalize_planning_package\(\s*p_session_id uuid,\s*p_provider_identity_id uuid,\s*p_package_id uuid,\s*p_expected_revision integer,\s*p_idempotency_key uuid/isu,
  "Missing controlled planning finalization function",
);
assert.match(
  allSql,
  /create or replace function graftvision_private\.invalidate_planning_package\(\s*p_session_id uuid,\s*p_provider_identity_id uuid,\s*p_package_id uuid,\s*p_expected_revision integer,\s*p_geometry_revision integer,\s*p_idempotency_key uuid/isu,
  "Missing controlled planning invalidation function",
);

function readFunctionSql(functionName) {
  const start = allSql.indexOf(`create or replace function ${functionName}`);
  const end = allSql.indexOf("\ncreate or replace function", start + 1);
  return allSql.slice(start, end === -1 ? undefined : end);
}

const finalizationSql = readFunctionSql("graftvision_private.finalize_planning_package");
const invalidationSql = readFunctionSql("graftvision_private.invalidate_planning_package");

for (const [operation, sql, markers] of [
  [
    "finalization",
    finalizationSql,
    [
      "PLANNING_ACCESS_DENIED",
      "PLANNING_REVISION_CONFLICT",
      "IDEMPOTENCY_KEY_REUSED",
      "PLANNING_NOT_CALCULATED",
      "for update",
      "scan_controlled",
      "planning.finalized",
      "request_family = 'finalize'",
    ],
  ],
  [
    "invalidation",
    invalidationSql,
    [
      "PLANNING_ACCESS_DENIED",
      "PLANNING_REVISION_CONFLICT",
      "IDEMPOTENCY_KEY_REUSED",
      "PLANNING_GEOMETRY_REVISION_INVALID",
      "PLANNING_NOT_INVALIDATABLE",
      "package_state = 'stale'",
      "revision = revision + 1",
      "'invalidated'",
      "for update",
      "scan_controlled",
      "planning.invalidated",
      "request_family = 'invalidate'",
    ],
  ],
]) {
  for (const marker of markers) {
    assert.match(
      sql,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"),
      `Missing ${operation} marker: ${marker}`,
    );
  }
}

console.log("Planning policy passed.");
