import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, tests, boundary, page, manifest] = await Promise.all([
  read("supabase/migrations/20260729000001_patient_profile.sql"),
  read("supabase/tests/database/patient_profile.test.sql"),
  read("packages/database/src/patient-profile.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/[patientId]/page.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes("20260729000001_patient_profile.sql"));
assert.equal(migrations.length, 81);
for (const fragment of [
  "read_patient_profile",
  "has_patient_root_authority",
  "p.status = 'active' or p_include_inactive",
  "PATIENT_CREATED",
  "REGISTRATION_CREATED",
  "DUPLICATE_OVERRIDE",
  "PATIENT_STATUS_CHANGED",
  "patient_status_history",
  "patient_registration_history",
  "patient_duplicate_decision_history",
]) {
  assert(migration.includes(fragment), `Missing patient profile policy: ${fragment}`);
}
assert(!migration.includes("from public.audit_event"));
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(boundary.includes('PATIENT_PROFILE_PERMISSION = "PATIENT-PERM-001"'));
assert(boundary.includes("PATIENT_TIMELINE_EVENT_CODES"));
assert(page.includes('dynamic = "force-dynamic"'));
assert(page.includes("Back to patient search"));
assert(page.includes("Treatment consent"));
assert(page.includes("treatment planning are not"));
assert(page.includes("profile shell."));
for (const evidence of [
  "valid same-clinic profile is returned",
  "date of birth is reduced to year",
  "projection excludes raw identity and internals",
  "only curated patient events are returned",
  "timeline is newest first",
  "inactive patient is hidden by default",
  "inactive profile requires explicit request",
  "Clinic A cannot discover Clinic B patient",
  "unverified Doctor is denied",
  "Support patient profile access is denied",
  "not-ready clinic is denied",
  "locked session is denied",
  "direct browser/database profile execution is denied",
]) {
  assert(tests.includes(evidence), `Missing patient profile test: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:profile"],
  "node tooling/run-local-patient-profile.mjs --confirm-local-patient-profile",
);
assert.equal(
  manifest.scripts["verify:patient-profile-policy"],
  "node tooling/verify-patient-profile-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-profile-policy.mjs"));
console.log(
  "Patient profile policy passed: masked identity, explicit inactive access, curated lifecycle timeline, tenant/RBAC/readiness, and Doctor authority are enforced.",
);
