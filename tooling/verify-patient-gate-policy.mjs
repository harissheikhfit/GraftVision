import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const requiredMigrations = [
  "20260728000006_patient_foundation.sql",
  "20260728000007_patient_registration.sql",
  "20260729000000_patient_search.sql",
  "20260729000001_patient_profile.sql",
  "20260729000002_patient_privacy_acknowledgement.sql",
  "20260729000003_patient_lifecycle.sql",
];
for (const migration of requiredMigrations) {
  assert(migrationNames.includes(migration), `Missing Patient Gate migration: ${migration}`);
}
const testPaths = [
  "supabase/tests/database/patient_foundation.test.sql",
  "supabase/tests/database/patient_registration.test.sql",
  "supabase/tests/database/patient_search.test.sql",
  "supabase/tests/database/patient_profile.test.sql",
  "supabase/tests/database/patient_consent.test.sql",
  "supabase/tests/database/patient_lifecycle.test.sql",
  "supabase/tests/database/patient_gate.test.sql",
];
const uiTestPaths = [
  "apps/web/src/app/(clinic)/clinic/patients/register/patient-registration-form.test.tsx",
  "apps/web/src/app/(clinic)/clinic/patients/page.test.tsx",
  "apps/web/src/app/(clinic)/clinic/patients/[patientId]/page.test.tsx",
  "apps/web/src/app/(clinic)/clinic/patients/[patientId]/patient-lifecycle-controls.test.tsx",
  "apps/web/src/app/(clinic)/clinic/patients/[patientId]/privacy/privacy-acknowledgement-form.test.tsx",
];
const [migrations, authority, tests, uiTests, gate, profile, search, manifest] = await Promise.all([
  Promise.all(requiredMigrations.map((name) => read(`supabase/migrations/${name}`))).then(
    (sources) => sources.join("\n"),
  ),
  read("supabase/migrations/20260727000004_rbac_authority_scope.sql"),
  Promise.all(testPaths.map(read)).then((sources) => sources.join("\n")),
  Promise.all(uiTestPaths.map(read)).then((sources) => sources.join("\n")),
  read("supabase/tests/database/patient_gate.test.sql"),
  read("packages/database/src/patient-profile.ts"),
  read("packages/database/src/patient-search.ts"),
  read("package.json").then(JSON.parse),
]);

for (const fragment of [
  "has_application_session_permission",
  "'clinic'",
  "PATIENT-PERM-001",
  "is_clinic_ready",
  "doctor_verification",
  "dv.status = 'verified'",
  "dv.expires_at > clock_timestamp()",
  "has_patient_root_authority",
  "is_patient_workflow_available",
  "patient_privacy_archive_guard",
  "lifecycle_state = 'current'",
  "p_include_archived",
]) {
  assert(migrations.includes(fragment), `Patient boundary missing: ${fragment}`);
}
for (const fragment of [
  "validate_application_session",
  "u.status = 'active'",
  "m.membership_status = 'active'",
  "c.status = 'active'",
]) {
  assert(authority.includes(fragment), `Session/RBAC boundary missing: ${fragment}`);
}
for (const trigger of [
  "patient_status_history_immutable",
  "patient_registration_history_immutable",
  "patient_privacy_ack_history_immutable",
  "patient_lifecycle_history_immutable",
]) {
  assert(migrations.includes(trigger), `Immutable history missing: ${trigger}`);
}
for (const action of [
  "patient.create",
  "patient.registration_create",
  "patient.duplicate_warning",
  "patient.duplicate_override",
  "patient.privacy_acknowledge",
  "patient.privacy_withdraw",
  "patient.archive",
  "patient.restore",
]) {
  assert(migrations.includes(`'${action}'`), `Patient audit action missing: ${action}`);
}
for (const field of [
  "normalisedName",
  "actorPlatformUserId",
  "auditMetadata",
  "idempotencyKey",
  "provenanceCode",
]) {
  assert(!profile.includes(`readonly ${field}:`), `Profile exposes ${field}`);
  assert(!search.includes(`readonly ${field}:`), `Search exposes ${field}`);
}
for (const evidence of [
  "Clinic A cannot read Clinic B patient root",
  "Clinic A cannot discover Clinic B by name",
  "Clinic A cannot discover Clinic B patient",
  "Clinic A cannot archive Clinic B patient",
  "Support ordinary patient access is denied",
  "Support patient profile access is denied",
  "unverified Doctor is denied",
  "not-ready clinic is denied",
  "locked session is denied",
  "revoked session is denied",
  "expired session is denied",
  "stale session is denied",
  "projection excludes raw identity and internals",
  "acknowledgement appends immutable history",
  "history is immutable",
  "direct lifecycle history mutation is denied",
  "patient audit metadata excludes sensitive data",
  "13-role catalogue is unchanged",
  "60-permission catalogue is unchanged",
]) {
  assert(tests.includes(evidence), `Missing Patient Gate evidence: ${evidence}`);
}
for (const policy of [
  "Platform and Support roles receive no patient permission",
  "patient authority validates the application session",
  "ordinary patient search excludes archived records",
  "shared workflow guard denies archived patients",
]) {
  assert(gate.includes(policy), `Missing consolidated gate assertion: ${policy}`);
}
for (const evidence of [
  "renders only the approved accessible registration fields",
  "renders accessible filters, masked results, and cursor navigation",
  "renders a masked accessible summary, curated timeline, and honest placeholders",
  "renders an explicit keyboard-accessible archive confirmation",
  "supports keyboard selection and explicit acknowledgement",
]) {
  assert(uiTests.includes(evidence), `Missing Patient Gate accessibility evidence: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:gate"],
  "node tooling/run-local-patient-gate.mjs --confirm-local-patient-gate",
);
assert.equal(
  manifest.scripts["verify:patient-gate-policy"],
  "node tooling/verify-patient-gate-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-gate-policy.mjs"));
console.log(
  "Patient Gate policy passed: migrations, authority, masking, privacy, lifecycle, audit, immutable history, and catalogue parity remain enforced.",
);
