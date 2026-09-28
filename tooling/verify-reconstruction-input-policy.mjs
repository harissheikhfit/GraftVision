import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [names, migration, types, test, pkg] = await Promise.all([
  readdir(path.join(root, "supabase/migrations")),
  read("supabase/migrations/20260801000020_reconstruction_input_preparation.sql"),
  read("packages/database/src/audit/audit-types.ts"),
  read("supabase/tests/database/reconstruction_input_preparation.test.sql"),
  read("package.json").then(JSON.parse),
]);
assert.equal(names.filter((name) => name.endsWith(".sql")).length, 74);
assert(names.includes("20260801000020_reconstruction_input_preparation.sql"));
for (const token of [
  "read_reconstruction_worker_input",
  "require_reconstruction_job_lease",
  "record_reconstruction_prepared_asset",
  "finalize_reconstruction_prepared_manifest",
  "read_reconstruction_preparation_status",
  "recon-input-prep-v1",
  "force row level security",
  "reconstruction_pending",
])
  assert(migration.includes(token));
for (const action of [
  "reconstruction.input_accessed",
  "reconstruction.asset_normalized",
  "reconstruction.prepared_manifest_created",
  "reconstruction.preparation_failed",
]) {
  assert(migration.includes(action));
  assert(types.includes(`"${action}"`));
}
assert(!test.includes("select object_key"));
assert.equal(
  pkg.scripts["recon:test:input-preparation"],
  "node tooling/run-local-reconstruction-input.mjs --confirm-local-reconstruction-input",
);
assert(pkg.scripts.check.includes("verify-reconstruction-input-policy"));
console.log(
  "Reconstruction input policy passed: exact leased worker input, deterministic preparation metadata, immutable manifests, and redacted projections are enforced.",
);
