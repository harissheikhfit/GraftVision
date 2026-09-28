import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationName = "20260731000000_consultation_preliminary_assessment.sql";
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, boundary, actions, tests, manifest] = await Promise.all([
  read(`supabase/migrations/${migrationName}`),
  read("packages/database/src/consultation-preliminary-assessment.ts"),
  read(
    "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/preliminary-assessment-actions.ts",
  ),
  read("supabase/tests/database/consultation_preliminary_assessment.test.sql"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes(migrationName), "CONSULT-004 must be present in the migration set.");
for (const evidence of [
  "preliminary_assessment_version",
  "enable row level security",
  "prevent_clinical_immutable_mutation",
  "CONSULT-PERM-001",
  "PATIENT-PERM-002",
  "preliminary_assessment_stale_medical",
  "preliminary_assessment_stale_hair",
  "downstream_stale",
]) {
  assert(migration.includes(evidence), `Missing preliminary-assessment policy: ${evidence}`);
}
for (const prohibited of [
  "submitted-for-review",
  "amendment-required",
  "create table public.reviewer",
  "reviewer_grant",
  "SCAN-PERM",
  "treatment_plan",
  "graft_estimate",
]) {
  assert(!migration.includes(prohibited), `Prohibited CONSULT-004 scope: ${prohibited}`);
}
assert(boundary.includes("PRELIMINARY_ASSESSMENT_REVIEW_STATES"));
assert(boundary.includes("savePreliminaryAssessment"));
assert(boundary.includes("transitionPreliminaryAssessmentReview"));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
assert(tests.includes("Assessment becomes stale when medical history gets a new version"));
assert.equal(
  manifest.scripts["verify:consultation-preliminary-assessment-policy"],
  "node tooling/verify-consultation-preliminary-assessment-policy.mjs",
);
assert(
  manifest.scripts.check.includes(
    "node tooling/verify-consultation-preliminary-assessment-policy.mjs",
  ),
);

console.log(
  "Consultation preliminary-assessment policy passed: immutable synthetic-only versions, safe binding, Doctor-only workflow, and no scanning scope.",
);
