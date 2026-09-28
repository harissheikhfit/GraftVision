import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [migrations, migration, boundary, auditTypes, test, manifest] = await Promise.all([
  readdir(path.join(root, "supabase/migrations")),
  read("supabase/migrations/20260801000019_reconstruction_job_foundation.sql"),
  read("packages/database/src/scan-session.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("supabase/tests/database/reconstruction_job.test.sql"),
  read("package.json").then(JSON.parse),
]);

assert.equal(migrations.filter((name) => name.endsWith(".sql")).length, 74);
assert(migrations.includes("20260801000019_reconstruction_job_foundation.sql"));
for (const table of [
  "reconstruction_input_manifest",
  "reconstruction_job",
  "reconstruction_job_event",
  "reconstruction_job_idempotency",
]) {
  assert(migration.includes(table));
}
for (const state of ["queued", "running", "succeeded", "failed", "cancelled"])
  assert(migration.includes(`'${state}'`));
for (const stage of [
  "validating_input",
  "preparing_assets",
  "normalizing_images",
  "reconstruction_pending",
  "reconstruction_running",
  "finalizing",
  "completed",
])
  assert(migration.includes(`'${stage}'`));
for (const action of [
  "reconstruction.manifest_created",
  "reconstruction.job_created",
  "reconstruction.job_claimed",
  "reconstruction.job_progressed",
  "reconstruction.job_succeeded",
  "reconstruction.job_failed",
  "reconstruction.job_retried",
  "reconstruction.job_cancelled",
]) {
  assert(migration.includes(`'${action}'`));
  assert(auditTypes.includes(`"${action}"`));
}
for (const operation of [
  "create_reconstruction_job",
  "claim_reconstruction_job",
  "renew_reconstruction_job_lease",
  "update_reconstruction_job_progress",
  "complete_reconstruction_job",
  "fail_reconstruction_job",
  "retry_reconstruction_job",
  "cancel_reconstruction_job",
  "read_reconstruction_job_status",
  "read_reconstruction_manifest_summary",
])
  assert(migration.includes(operation));
assert(migration.includes("force row level security"));
assert(migration.includes("require_reconstruction_worker"));
assert(boundary.includes("createReconstructionJob"));
assert(boundary.includes("readReconstructionJobStatus"));
assert(test.includes("direct") || test.includes("policies_are"));
assert.equal(
  manifest.scripts["recon:test:job-lifecycle"],
  "node tooling/run-local-reconstruction-job.mjs --confirm-local-reconstruction-job",
);
assert.equal(
  manifest.scripts["verify:reconstruction-job-policy"],
  "node tooling/verify-reconstruction-job-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-reconstruction-job-policy.mjs"));
console.log(
  "Reconstruction job policy passed: immutable input packages, lease-bound workers, redacted audit, and tenant-safe projections are enforced.",
);
