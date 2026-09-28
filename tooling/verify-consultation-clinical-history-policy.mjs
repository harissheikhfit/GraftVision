import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationName = "20260730000001_consultation_clinical_history.sql";
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, boundary, panel, actions, tests, manifest] = await Promise.all([
  read(`supabase/migrations/${migrationName}`),
  read("packages/database/src/consultation-clinical-history.ts"),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/clinical-history-panel.tsx",
  ),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/clinical-history-actions.ts",
  ),
  read("supabase/tests/database/consultation_clinical_history.test.sql"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes(migrationName), "CONSULT-003 must be present in the migration set.");
for (const evidence of [
  "patient_medical_history_version",
  "consultation_hair_loss_history_version",
  "consultation_history_binding",
  "doctor_private_note_version",
  "clinical_operation_idempotency",
  "enable row level security",
  "force row level security",
  "CLINICAL_HISTORY_IMMUTABLE",
  "CONSULT-PERM-001",
  "CONSULT-PERM-002",
  "PATIENT-PERM-002",
  "PATIENT-PERM-003",
  "ASSIGNED_VERIFIED_DOCTOR_REQUIRED",
  "downstream_stale",
  "doctor_private_note.sensitive_read",
]) {
  assert(migration.includes(evidence), `Missing clinical-history policy: ${evidence}`);
}
for (const prohibited of [
  "create table public.reviewer",
  "reviewer_grant",
  "SCAN-PERM",
  "patient_safe_projection",
  "treatment_plan",
  "graft_estimate",
]) {
  assert(!migration.includes(prohibited), `Prohibited CONSULT-003 scope: ${prohibited}`);
}
assert(boundary.includes("CLINICAL_REVIEW_STATES"));
assert(boundary.includes("saveMedicalHistory"));
assert(boundary.includes("saveHairLossHistory"));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
assert(panel.replace(/\s+/g, " ").includes("Reviewer"));
assert(panel.replace(/\s+/g, " ").includes("access is disabled."));
assert(panel.replace(/\s+/g, " ").includes("Autosave"));
assert(tests.includes("existing 13-role catalogue is unchanged"));
assert.equal(
  manifest.scripts["consultation:test:clinical-history"],
  "node tooling/run-local-consultation-clinical-history.mjs --confirm-local-consultation-clinical-history",
);
assert.equal(
  manifest.scripts["verify:consultation-clinical-history-policy"],
  "node tooling/verify-consultation-clinical-history-policy.mjs",
);
assert(
  manifest.scripts.check.includes("node tooling/verify-consultation-clinical-history-policy.mjs"),
);

console.log(
  "Consultation clinical-history policy passed: immutable synthetic-only versions, Doctor-private separation, forced RLS, safe concurrency, and no scanning scope.",
);
