import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [migration, rbacCatalogue, rbacAssignments, tests, boundary, auditTypes, manifest] =
  await Promise.all([
    read("supabase/migrations/20260727000005_doctor_authority_foundation.sql"),
    read("supabase/migrations/20260727000000_rbac_foundation.sql"),
    read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
    read("supabase/tests/database/doctor_authority.test.sql"),
    read("packages/database/src/doctor-authority.ts"),
    read("packages/database/src/audit/audit-types.ts"),
    read("package.json").then(JSON.parse),
  ]);

assert(rbacCatalogue.includes("('ROLE-006'), ('ROLE-007'), ('ROLE-008'), ('ROLE-009')"));
assert(rbacAssignments.includes("('CLINIC_OWNER', 'ROLE-007')"));
assert(rbacAssignments.includes("('CLINIC_OWNER', 'ROLE-009')"));
assert(rbacAssignments.includes("('CLINIC_ADMIN', 'ROLE-009')"));
assert(!rbacAssignments.includes("('CLINIC_ADMIN', 'ROLE-007')"));

for (const fragment of [
  "create table public.doctor_verification (",
  "create table public.doctor_verification_evidence (",
  "create table public.doctor_verification_history (",
  "doctor_verification_clinic_user_unique",
  "DOCTOR_VERIFICATION_HISTORY_IMMUTABLE",
  "transition_doctor_verification",
  "has_doctor_authority",
  "p_required_permission",
  "clock_timestamp()",
  "SELF_VERIFICATION_DENIED",
  "role_code = 'DOCTOR'",
  "'ROLE-007'",
  "'ROLE-009'",
  "authorization_version = authorization_version + 1",
]) {
  assert(migration.includes(fragment), `Doctor authority migration is missing ${fragment}.`);
}

assert(
  !migration.includes("insert into public.permission_definition"),
  "APPROVAL-001 must not change the permission catalogue.",
);
assert(
  !migration.includes("insert into public.role_definition"),
  "APPROVAL-001 must not change the role catalogue.",
);
assert(
  !migration.toLowerCase().includes("credential_document"),
  "Raw credential document storage is prohibited.",
);
assert(
  migration.includes("revoke all on table public.doctor_verification_evidence"),
  "Restricted evidence metadata must not be routinely readable.",
);

for (const requiredTest of [
  "self-verification is denied",
  "combined Clinic Owner and Doctor roles do not imply Doctor authority",
  "Platform Support receives no Doctor authority",
  "database time denies expired verification immediately",
  "normal authority reads do not create expiry audit events",
  "history update is denied",
  "role catalogue remains exactly thirteen roles",
  "permission catalogue remains exactly sixty permissions",
]) {
  assert(
    tests.includes(requiredTest),
    `Doctor authority test coverage is missing: ${requiredTest}.`,
  );
}

assert(boundary.includes("transition_doctor_verification"));
assert(boundary.includes("has_doctor_authority"));
assert(auditTypes.includes('"doctor.verification.verified"'));
assert(auditTypes.includes('"doctor_verification"'));

assert.equal(
  manifest.scripts["doctor:test:authority"],
  "node tooling/run-local-doctor-authority.mjs --confirm-local-doctor-authority",
);
assert.equal(
  manifest.scripts["verify:doctor-authority-policy"],
  "node tooling/verify-doctor-authority-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-doctor-authority-policy.mjs"));

console.log(
  "Doctor authority policy passed: clinic verification, immutable history, restricted evidence, trusted transitions, expiry denial, and unchanged catalogues are enforced.",
);
