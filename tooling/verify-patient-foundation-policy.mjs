import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const [migration, assignments, tests, boundary, auditTypes, manifest] = await Promise.all([
  read("supabase/migrations/20260728000006_patient_foundation.sql"),
  read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
  read("supabase/tests/database/patient_foundation.test.sql"),
  read("packages/database/src/patient-foundation.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("package.json").then(JSON.parse),
]);

assert(migrationNames.includes("20260728000006_patient_foundation.sql"));
assert.equal(migrationNames.length, 81);
assert(assignments.includes("('DOCTOR', 'PATIENT-PERM-001')"));
assert(assignments.includes("('CLINICAL_ASSISTANT', 'PATIENT-PERM-001')"));
assert(assignments.includes("('RECEPTION', 'PATIENT-PERM-001')"));

for (const fragment of [
  "clinic_patient_counter",
  "patient_status_history",
  "patient_creation_idempotency",
  "patient_number ~ '^GV-[0-9]{6}$'",
  "unique (clinic_id, patient_number)",
  "status in ('active', 'inactive')",
  "provenance_code = 'MANUAL_REGISTRATION'",
  "force row level security",
  "PATIENT_CONTROLLED_MUTATION_REQUIRED",
  "has_patient_root_authority",
  "is_clinic_ready",
  "has_application_session_permission",
  "PATIENT-PERM-001",
  "doctor_verification",
  "create_patient_root",
  "read_patient_root",
  "change_patient_status",
  "patient.create",
  "patient.status_change",
]) {
  assert(migration.includes(fragment), `Missing patient foundation policy: ${fragment}`);
}

assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
for (const forbiddenColumn of [
  "name text",
  "phone",
  "email",
  "cnic",
  "address",
  "date_of_birth",
  "gender",
  "diagnosis",
  "medical_history",
  "consent",
  "media",
]) {
  assert(!migration.match(new RegExp(`\\b${forbiddenColumn}\\b`, "iu")));
}
assert(boundary.includes('PATIENT_ROOT_PERMISSION = "PATIENT-PERM-001"'));
assert(boundary.includes('PATIENT_ROOT_STATUSES = ["active", "inactive"]'));
assert(boundary.includes('PATIENT_PROVENANCE_CODES = ["MANUAL_REGISTRATION"]'));
assert(auditTypes.includes('"patient.create"'));
assert(auditTypes.includes('"patient.status_change"'));

for (const evidence of [
  "successful creation writes one patient",
  "first patient number is generated server-side",
  "same patient number may exist in another clinic",
  "idempotent retry creates no duplicate patient",
  "same key with changed payload is rejected",
  "Clinic A cannot read Clinic B patient root",
  "verified Doctor may create patient root",
  "unverified Doctor is denied",
  "not-ready clinic is denied",
  "locked session is denied",
  "patient number is immutable through direct writes",
  "patient history is immutable",
  "patient root has no identity contact or clinical fields",
  "patient audit metadata excludes sensitive data",
]) {
  assert(tests.includes(evidence), `Missing patient foundation test: ${evidence}`);
}

assert.equal(
  manifest.scripts["patient:test:foundation"],
  "node tooling/run-local-patient-foundation.mjs --confirm-local-patient-foundation",
);
assert.equal(
  manifest.scripts["verify:patient-foundation-policy"],
  "node tooling/verify-patient-foundation-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-foundation-policy.mjs"));

console.log(
  "Patient foundation policy passed: minimal tenant root, deterministic numbering, onboarding and Doctor authority, idempotency, immutable history, audit, and privacy boundaries are enforced.",
);
