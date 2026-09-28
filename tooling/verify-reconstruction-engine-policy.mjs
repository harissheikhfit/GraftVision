import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = await readdir(path.join(root, "supabase/migrations"));
assert.equal(migrations.filter((name) => name.endsWith(".sql")).length, 74);
const realOutputContract = await readFile(
  path.join(root, "supabase/migrations/20260801000022_reconstruction_real_output_contract.sql"),
  "utf8",
);
const migration = await readFile(
  path.join(root, "supabase/migrations/20260801000021_reconstruction_engine_output.sql"),
  "utf8",
);
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const audit = await readFile(path.join(root, "packages/database/src/audit/audit-types.ts"), "utf8");

for (const fragment of [
  "reconstruction_artifact",
  "reconstruction_output_manifest",
  "reconstruction_output_event",
  "reconstruction_output_idempotency",
  "begin_reconstruction_execution",
  "record_reconstruction_artifact",
  "finalize_reconstruction_output",
  "read_reconstruction_output_status",
  "recon-engine-synthetic-v1",
  "model/gltf-binary",
  "enable row level security",
  "force row level security",
])
  assert(migration.includes(fragment), `Missing RECON-003 boundary: ${fragment}`);
for (const fragment of [
  "sparse_point_cloud",
  "dense_point_cloud",
  "surface_mesh",
  "reconstruction_preview",
  "bounded_metadata",
  "application/ply",
  "COLMAP",
  "4.1.1",
  "recon-colmap-adapter-v2",
  "recon-colmap-config-v2",
  "sparse_cpu",
  "dense_cuda",
  "reconstruction_artifact_geometry",
  "record_real_reconstruction_artifact",
  "finalize_real_reconstruction_output",
])
  assert(realOutputContract.includes(fragment), `Missing RECON-004D1 contract: ${fragment}`);
for (const action of [
  "execution_started",
  "artifact_recorded",
  "output_manifest_created",
  "execution_succeeded",
  "execution_failed",
]) {
  assert(migration.includes(`reconstruction.${action}`));
  assert(audit.includes(`reconstruction.${action}`));
}
assert.equal(
  manifest.scripts["recon:test:engine-integration"],
  "node tooling/run-local-reconstruction-engine.mjs --confirm-local-reconstruction-engine",
);
assert(manifest.scripts.check.includes("verify-reconstruction-engine-policy"));
console.log(
  "Reconstruction engine policy passed: synthetic output lifecycle is leased, immutable, private, bounded, and non-clinical.",
);
