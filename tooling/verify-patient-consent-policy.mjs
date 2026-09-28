import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, tests, boundary, page, form, manifest] = await Promise.all([
  read("supabase/migrations/20260729000002_patient_privacy_acknowledgement.sql"),
  read("supabase/tests/database/patient_consent.test.sql"),
  read("packages/database/src/patient-consent.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/[patientId]/privacy/page.tsx"),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/privacy/privacy-acknowledgement-form.tsx",
  ),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes("20260729000002_patient_privacy_acknowledgement.sql"));
assert.equal(migrations.length, 81);
for (const fragment of [
  "REGISTRATION_PRIVACY",
  "language in ('en', 'ur')",
  "pending', 'acknowledged', 'withdrawn', 'superseded",
  "PATIENT_REQUEST",
  "REPRESENTATIVE_AUTHORITY_NOT_VERIFIED",
  "has_patient_root_authority",
  "PRIVACY_ACKNOWLEDGEMENT_CONFLICT",
  "patient_privacy_acknowledgement_history",
  "patient.privacy_acknowledge",
  "patient.privacy_withdraw",
  "force row level security",
  "NOTICE_PARITY_REQUIRED",
]) {
  assert(migration.includes(fragment), `Missing patient consent policy: ${fragment}`);
}
for (const prohibited of [
  "create table public.patient_treatment_consent",
  "create table public.patient_resource_acknowledgement",
  "signature bytea",
  "cnic",
  "insert into public.permission_definition",
  "insert into public.role_definition",
]) {
  assert(!migration.toLowerCase().includes(prohibited), `Prohibited scope: ${prohibited}`);
}
assert(boundary.includes('PATIENT_CONSENT_PERMISSION = "PATIENT-PERM-001"'));
assert(boundary.includes('PRIVACY_PURPOSE_CODE = "REGISTRATION_PRIVACY"'));
assert(page.includes('dynamic = "force-dynamic"'));
assert(form.includes("This record is separate from treatment"));
assert(form.includes('dir="rtl"'));
assert(form.includes("explicitly acknowledged"));
assert(form.includes("Withdrawal applies prospectively"));
for (const evidence of [
  "English and Urdu parity",
  "privacy notice acknowledgement succeeds",
  "withdrawal is recorded prospectively",
  "purpose isolation is enforced",
  "representative denial without verified authority",
  "acknowledgement retry is idempotent",
  "stale acknowledgement revision is denied",
  "same-clinic isolation denies foreign patient",
  "unverified Doctor is denied",
  "not-ready clinic is denied",
  "locked session is denied",
  "history is immutable",
  "audit metadata excludes prohibited evidence",
]) {
  assert(tests.includes(evidence), `Missing patient consent test: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:consent"],
  "node tooling/run-local-patient-consent.mjs --confirm-local-patient-consent",
);
assert.equal(
  manifest.scripts["verify:patient-consent-policy"],
  "node tooling/verify-patient-consent-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-consent-policy.mjs"));
console.log(
  "Patient consent policy passed: registration/privacy acknowledgement is purpose-specific, bilingual, immutable, tenant-scoped, withdrawable, and separate from treatment consent.",
);
