import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, boundary, profile, search, controls, tests, manifest] = await Promise.all([
  read("supabase/migrations/20260729000003_patient_lifecycle.sql"),
  read("packages/database/src/patient-lifecycle.ts"),
  read("packages/database/src/patient-profile.ts"),
  read("packages/database/src/patient-search.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/[patientId]/patient-lifecycle-controls.tsx"),
  read("supabase/tests/database/patient_lifecycle.test.sql"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes("20260729000003_patient_lifecycle.sql"));
assert.equal(migrations.length, 81);
for (const fragment of [
  "lifecycle_state",
  "lifecycle_revision",
  "patient_lifecycle_history",
  "patient_lifecycle_idempotency",
  "transition_patient_lifecycle",
  "is_patient_workflow_available",
  "PATIENT-PERM-001",
  "patient.archive",
  "patient.restore",
  "PATIENT_LIFECYCLE_CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "patient_privacy_archive_guard",
]) {
  assert(
    migration.includes(fragment) || boundary.includes(fragment),
    `Missing patient lifecycle policy: ${fragment}`,
  );
}
assert(!migration.includes("DELETE-PERM-001"));
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(profile.includes("includeArchived"));
assert(search.includes('"archived"'));
assert(controls.includes("I confirm this reversible"));
assert(controls.includes("lifecycle change."));
for (const evidence of [
  "archive succeeds",
  "restore succeeds",
  "archived patient is excluded from default search",
  "archived patient requires explicit profile access",
  "stale lifecycle revision is rejected",
  "idempotent retry creates no duplicate history or audit",
  "Clinic A cannot archive Clinic B patient",
  "locked session is denied",
  "privacy acknowledgement is preserved",
  "direct lifecycle history mutation is denied",
]) {
  assert(tests.includes(evidence), `Missing lifecycle test: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:lifecycle"],
  "node tooling/run-local-patient-lifecycle.mjs --confirm-local-patient-lifecycle",
);
assert.equal(
  manifest.scripts["verify:patient-lifecycle-policy"],
  "node tooling/verify-patient-lifecycle-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-lifecycle-policy.mjs"));
console.log(
  "Patient lifecycle policy passed: reversible archive/restore, controlled reasons, tenant authority, immutable evidence, privacy preservation, and archive-aware projections are enforced.",
);
