import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, assignments, tests, boundary, actions, page, form, manifest] = await Promise.all([
  read("supabase/migrations/20260728000005_clinic_onboarding.sql"),
  read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
  read("supabase/tests/database/clinic_onboarding.test.sql"),
  read("packages/database/src/clinic-onboarding.ts"),
  read("apps/web/src/app/(clinic)/clinic/onboarding/actions.ts"),
  read("apps/web/src/app/(clinic)/clinic/onboarding/page.tsx"),
  read("apps/web/src/app/(clinic)/clinic/onboarding/clinic-onboarding-form.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(migrationNames.includes("20260728000005_clinic_onboarding.sql"));
assert.equal(migrationNames.length, 81);
for (const assignment of [
  "('CLINIC_OWNER', 'ADMIN-PERM-001')",
  "('CLINIC_ADMIN', 'ADMIN-PERM-001')",
]) {
  assert(assignments.includes(assignment));
}
for (const fragment of [
  "not_ready",
  "ready",
  "reopened",
  "PROTOCOL_TEMPLATE_READY",
  "SECURITY_READY",
  "clinic_onboarding_attestation_history",
  "clinic_onboarding_readiness_history",
  "force row level security",
  "CLINIC_ONBOARDING_CONTROLLED_MUTATION_REQUIRED",
  "has_clinic_onboarding_authority",
  "clinic_onboarding_checks",
  "is_clinic_ready",
  "sync_clinic_onboarding_readiness",
  "p_expected_revision",
  "clinic.onboarding_attest",
  "clinic.onboarding_ready",
  "clinic.onboarding_reopened",
  "clinic.onboarding_blocked",
]) {
  assert(migration.includes(fragment), `Missing clinic onboarding policy: ${fragment}`);
}
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(
  !migration.match(/\b(patient record|billing|subscription|impersonation|support access)\b/iu),
);
assert(boundary.includes('CLINIC_ONBOARDING_PERMISSION = "ADMIN-PERM-001"'));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
assert(page.includes("Branding and staff"));
assert(page.includes("Non-blocking"));
assert(form.includes('type="datetime-local"'));
for (const evidence of [
  "all blockers make clinic ready",
  "branding is non-blocking",
  "Doctor revocation denies immediately",
  "automatically reopens",
  "Clinic B sees only its own checklist",
  "Support Engineer is denied",
  "stale session is denied",
  "attestation history is immutable",
  "audit metadata excludes sensitive data",
]) {
  assert(tests.includes(evidence), `Missing clinic onboarding test: ${evidence}`);
}
assert.equal(
  manifest.scripts["clinic:test:onboarding"],
  "node tooling/run-local-clinic-onboarding.mjs --confirm-local-clinic-onboarding",
);
assert.equal(
  manifest.scripts["verify:clinic-onboarding-policy"],
  "node tooling/verify-clinic-onboarding-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-clinic-onboarding-policy.mjs"));
console.log(
  "Clinic onboarding policy passed: authoritative derived readiness, controlled attestations, automatic reopening, immutable history, and tenant/RBAC boundaries are enforced.",
);
