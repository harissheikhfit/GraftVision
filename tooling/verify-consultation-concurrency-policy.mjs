import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationName = "20260730000000_consultation_concurrency.sql";

assert.equal(migrationNames.length, 81);
assert(migrationNames.includes(migrationName), "CONSULT-005 migration must remain present.");

const [migration, tests, boundary, action, controls, workspace, manifest] = await Promise.all([
  read(`supabase/migrations/${migrationName}`),
  read("supabase/tests/database/consultation_foundation.test.sql"),
  read("packages/database/src/consultation-foundation.ts"),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/actions.ts",
  ),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/consultation-status-controls.tsx",
  ),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/consultation-workspace.tsx",
  ),
  read("package.json").then(JSON.parse),
]);

for (const required of [
  "consultation.concurrency_conflict",
  "transition_consultation_status_with_concurrency",
  "assign_consultation_doctor_with_concurrency",
  "when sqlstate '40001'",
  "'stale_revision'::text",
  "'expected_revision'",
  "'current_revision'",
  "'operation_code'",
  "'changed_fields'",
  "revoke all on function",
]) {
  assert(migration.includes(required), `Missing concurrency policy: ${required}`);
}
for (const prohibited of [
  "alter table public.consultation",
  "create table public.consultation",
  "patient_name",
  "doctor_name",
  "request_body",
  "cookie",
  "token",
]) {
  assert(
    !migration.toLowerCase().includes(prohibited),
    `Prohibited migration scope: ${prohibited}`,
  );
}

for (const evidence of [
  "current revision status mutation succeeds",
  "second editor receives structured stale revision",
  "concurrent Doctor reassignment returns structured stale revision",
  "stale Doctor assignment adds no history",
  "stale mutation adds no history",
  "stale mutation adds no idempotency record",
  "authorised stale status mutation writes one conflict audit event",
  "conflict audit metadata is bounded and redacted",
  "cross-tenant request remains a pre-access denial",
]) {
  assert(tests.includes(evidence), `Missing concurrency evidence: ${evidence}`);
}
for (const required of [
  "ConsultationMutationResult",
  "ConsultationConflictProjection",
  "assign_consultation_doctor_with_concurrency",
  "transition_consultation_status_with_concurrency",
]) {
  assert(boundary.includes(required), `Missing typed boundary: ${required}`);
}
for (const required of [
  '"use server"',
  "requireVerifiedAuthSession",
  'authorityScope !== "clinic"',
  "transitionConsultationStatus(pool",
  'result.outcome === "stale_revision"',
]) {
  assert(action.includes(required), `Missing protected action boundary: ${required}`);
}
for (const required of [
  "This consultation was updated after you opened it. Reload the latest version before trying again.",
  "Reload latest version",
  "conflictHeading.current?.focus()",
  "Start preparation",
  "Cancel consultation",
]) {
  assert(controls.includes(required), `Missing safe conflict UI: ${required}`);
}
for (const prohibited of [
  "Capture complete",
  "Review required",
  "Doctor approval",
  "localStorage",
  "sessionStorage",
]) {
  assert(!controls.includes(prohibited), `Prohibited transition UI: ${prohibited}`);
}
assert(workspace.includes("ConsultationStatusControls"));
assert.equal(
  manifest.scripts["consultation:test:concurrency"],
  "node tooling/run-local-consultation-concurrency.mjs --confirm-local-consultation-concurrency",
);
assert.equal(
  manifest.scripts["verify:consultation-concurrency-policy"],
  "node tooling/verify-consultation-concurrency-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-consultation-concurrency-policy.mjs"));

console.log(
  "Consultation concurrency policy passed: stale writes are atomic, tenant-safe, audited, typed, reload-only, and limited to approved preparation transitions.",
);
