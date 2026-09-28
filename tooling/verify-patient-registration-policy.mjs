import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, tests, boundary, actions, form, manifest] = await Promise.all([
  read("supabase/migrations/20260728000007_patient_registration.sql"),
  read("supabase/tests/database/patient_registration.test.sql"),
  read("packages/database/src/patient-registration.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/register/actions.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/register/patient-registration-form.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(migrationNames.includes("20260728000007_patient_registration.sql"));
assert.equal(migrationNames.length, 81);
for (const fragment of [
  "patient_registration",
  "patient_registration_history",
  "patient_duplicate_decision_history",
  "patient_registration_idempotency",
  "normalised_name",
  "REGISTRATION_FORM",
  "PHONE_EXACT",
  "EMAIL_EXACT",
  "NAME_DOB_EXACT",
  "CONFIRMED_DISTINCT_PERSON",
  "KNOWN_SEPARATE_RECORD",
  "force row level security",
  "has_patient_root_authority",
  "register_patient",
  "patient.registration_create",
  "patient.duplicate_warning",
  "patient.duplicate_override",
]) {
  assert(migration.includes(fragment), `Missing patient registration policy: ${fragment}`);
}
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(!migration.match(/\b(cnic|national_id|gender|sex|diagnosis|medical_history|consent)\b/iu));
assert(boundary.includes('PATIENT_REGISTRATION_PERMISSION = "PATIENT-PERM-001"'));
assert(boundary.includes("PATIENT_DUPLICATE_OVERRIDE_REASONS"));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
assert(form.includes("Masked same-clinic matches"));
assert(form.includes("I confirm this is a distinct patient record."));
assert(!form.match(/\b(patient list|merge patient|consultation|consent)\b/iu));
for (const evidence of [
  "valid registration succeeds",
  "phone is normalised to E.164",
  "same identity-like values in another clinic do not warn",
  "same-clinic phone produces duplicate warning",
  "duplicate projection excludes full identity and contact values",
  "warning without override creates no patient",
  "authorised controlled duplicate override succeeds",
  "override retry creates no duplicate history",
  "unverified Doctor is denied",
  "locked session is denied",
  "patient registration audit excludes sensitive data",
]) {
  assert(tests.includes(evidence), `Missing patient registration test: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:registration"],
  "node tooling/run-local-patient-registration.mjs --confirm-local-patient-registration",
);
assert.equal(
  manifest.scripts["verify:patient-registration-policy"],
  "node tooling/verify-patient-registration-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-registration-policy.mjs"));
console.log(
  "Patient registration policy passed: bounded identity fields, deterministic same-clinic matching, masked warnings, controlled overrides, idempotency, and privacy boundaries are enforced.",
);
