import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [migration, catalogue, assignments, tests, boundary, auditTypes, manifest] =
  await Promise.all([
    read("supabase/migrations/20260728000001_clinic_lifecycle.sql"),
    read("supabase/migrations/20260727000000_rbac_foundation.sql"),
    read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
    read("supabase/tests/database/clinic_lifecycle.test.sql"),
    read("packages/database/src/clinic-lifecycle.ts"),
    read("packages/database/src/audit/audit-types.ts"),
    read("package.json").then(JSON.parse),
  ]);

assert(assignments.includes("('PLATFORM_OWNER', 'ADMIN-PERM-006')"));
assert(assignments.includes("('PLATFORM_ADMIN', 'ADMIN-PERM-006')"));
assert(!assignments.includes("('PLATFORM_SUPPORT', 'ADMIN-PERM-006')"));
assert(catalogue.includes("('ADMIN-PERM-006')"));

for (const fragment of [
  "check (status in ('active', 'suspended', 'inactive'))",
  "create table public.clinic_status_history (",
  "CLINIC_STATUS_HISTORY_IMMUTABLE",
  "CLINIC_CODE_IMMUTABLE",
  "has_clinic_lifecycle_authority",
  "create_clinic",
  "transition_clinic_status",
  "'ADMIN-PERM-006'",
  "pur.role_code in ('PLATFORM_OWNER', 'PLATFORM_ADMIN')",
  "authorization_version = authorization_version + 1",
  "'clinic.create'",
  "'clinic.suspend'",
  "'clinic.reactivate'",
  "'clinic.inactivate'",
  "enable row level security",
  "force row level security",
]) {
  assert(migration.includes(fragment), `Clinic lifecycle migration is missing ${fragment}.`);
}

for (const transition of [
  "v_previous_status = 'active'\n    and p_new_status = 'suspended'",
  "v_previous_status = 'suspended'\n    and p_new_status = 'active'",
  "v_previous_status in ('active', 'suspended')\n    and p_new_status = 'inactive'",
]) {
  assert(migration.includes(transition), `Controlled transition graph is missing ${transition}.`);
}

assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(!migration.match(/\b(onboarding|closing|closed)\b/iu));
assert(!migration.match(/\b(billing|branding|subscription|patient|clinical)\b/iu));
assert(!migration.match(/\b(mfa|otp|totp)\b/iu));
assert(!migration.includes("grant execute"));
assert(!migration.includes("grant insert"));

for (const requiredTest of [
  "Platform Owner creates a clinic",
  "Platform Administrator creates a clinic",
  "Platform Support Engineer is denied clinic creation",
  "clinic-scoped roles are denied clinic creation",
  "forged provider identity is denied",
  "inactive platform user session is denied",
  "stale platform session is denied",
  "revoked platform session is denied",
  "locked platform session is denied",
  "suspension immediately denies the affected clinic session",
  "Clinic A suspension does not affect Clinic B",
  "reactivation does not restore the old clinic session",
  "clinic status history updates are denied",
  "role catalogue remains exactly thirteen roles",
  "permission catalogue remains exactly sixty permissions",
]) {
  assert(tests.includes(requiredTest), `Clinic lifecycle coverage is missing: ${requiredTest}.`);
}

assert(boundary.includes('export const CLINIC_LIFECYCLE_PERMISSION = "ADMIN-PERM-006"'));
assert(boundary.includes("graftvision_private.create_clinic"));
assert(boundary.includes("graftvision_private.transition_clinic_status"));
assert(auditTypes.includes('"clinic.create"'));
assert(auditTypes.includes('"clinic.inactivate"'));

assert.equal(
  manifest.scripts["clinic:test:lifecycle"],
  "node tooling/run-local-clinic-lifecycle.mjs --confirm-local-clinic-lifecycle",
);
assert.equal(
  manifest.scripts["verify:clinic-lifecycle-policy"],
  "node tooling/verify-clinic-lifecycle-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-clinic-lifecycle-policy.mjs"));

console.log(
  "Clinic lifecycle policy passed: exact MVP states, controlled platform authority, immutable history, session propagation, and unchanged catalogues are enforced.",
);
