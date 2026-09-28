import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const migrationName = "20260729000006_consultation_foundation.sql";
assert(migrationNames.includes(migrationName));
assert.equal(migrationNames.length, 81);

const [migration, tests, boundary, auditTypes, manifest] = await Promise.all([
  read(`supabase/migrations/${migrationName}`),
  read("supabase/tests/database/consultation_foundation.test.sql"),
  read("packages/database/src/consultation-foundation.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("package.json").then(JSON.parse),
]);

for (const fragment of [
  "('CONSULT-PERM-003')",
  "('CLINIC_OWNER', 'CONSULT-PERM-003')",
  "('CLINIC_ADMIN', 'CONSULT-PERM-003')",
  "create table public.consultation (",
  "create table public.consultation_assignment (",
  "create table public.consultation_status_history (",
  "create table public.consultation_assignment_history (",
  "create table public.consultation_operation_idempotency (",
  "force row level security",
  "consultation_patient_fk",
  "CONSULTATION_CONTROLLED_MUTATION_REQUIRED",
  "CONSULTATION_HISTORY_IMMUTABLE",
  "has_application_session_permission",
  "is_clinic_ready",
  "is_patient_workflow_available",
  "is_assignable_consultation_doctor",
  "doctor_verification",
  "create_consultation",
  "read_consultation",
  "list_consultations",
  "assign_consultation_doctor",
  "transition_consultation_status",
  "consultation.create",
  "consultation.doctor_assign",
  "consultation.doctor_reassign",
  "consultation.status_change",
]) {
  assert(migration.includes(fragment), `Missing consultation policy: ${fragment}`);
}

for (const prohibitedMapping of [
  "('DOCTOR', 'CONSULT-PERM-003')",
  "('CLINICAL_ASSISTANT', 'CONSULT-PERM-003')",
  "('RECEPTION', 'CONSULT-PERM-003')",
  "('PLATFORM_OWNER', 'CONSULT-PERM-003')",
  "('PLATFORM_ADMIN', 'CONSULT-PERM-003')",
  "('PLATFORM_SUPPORT', 'CONSULT-PERM-003')",
]) {
  assert(
    !migration.includes(prohibitedMapping),
    `Prohibited permission mapping: ${prohibitedMapping}`,
  );
}
assert.equal((migration.match(/insert into public\.permission_definition/gu) ?? []).length, 1);
assert(!migration.includes("insert into public.role_definition"));
for (const prohibitedScope of [
  "capture_session",
  "scan_token",
  "media_object",
  "lidar",
  "reconstruction",
  "graft_estimate",
  "hairline",
  "ai_suggestion",
  "doctor_approval",
]) {
  assert(
    !migration.toLowerCase().includes(prohibitedScope),
    `Prohibited scope: ${prohibitedScope}`,
  );
}

for (const evidence of [
  "permission catalogue is exactly sixty",
  "same-clinic consultation creation succeeds",
  "idempotent creation adds no duplicate",
  "cross-clinic patient is denied",
  "archived patient is non-actionable",
  "not-ready clinic is denied",
  "platform scope is denied",
  "revoked Doctor authority is denied",
  "Clinic B cannot read Clinic A consultation",
  "eligible same-clinic Doctor assignment succeeds",
  "cross-clinic Doctor assignment is denied",
  "revoked Doctor assignment is denied",
  "stale concurrent assignment is denied",
  "consultation status history is immutable",
  "consultation assignment history is immutable",
  "completion remains unavailable until its later clinical gate",
  "locked session is denied",
  "stale session is denied",
  "inactive membership is denied",
  "all consultation tables enable and force RLS",
  "consultation audit metadata excludes sensitive data",
]) {
  assert(tests.includes(evidence), `Missing consultation test evidence: ${evidence}`);
}

assert(boundary.includes('CONSULTATION_DRAFT_PERMISSION = "CONSULT-PERM-001"'));
assert(boundary.includes('CONSULTATION_DOCTOR_ASSIGNMENT_PERMISSION = "CONSULT-PERM-003"'));
assert(boundary.includes('"capture-complete"'));
assert(boundary.includes("replaceAll"));
assert(auditTypes.includes('"consultation.create"'));
assert(auditTypes.includes('"consultation_assignment"'));
assert.equal(
  manifest.scripts["consultation:test:foundation"],
  "node tooling/run-local-consultation-foundation.mjs --confirm-local-consultation-foundation",
);
assert.equal(
  manifest.scripts["verify:consultation-foundation-policy"],
  "node tooling/verify-consultation-foundation-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-consultation-foundation-policy.mjs"));

console.log(
  "Consultation foundation policy passed: tenant-bound drafts, controlled lifecycle, dedicated Doctor assignment, immutable history, idempotency, RLS, and audit boundaries are enforced.",
);
