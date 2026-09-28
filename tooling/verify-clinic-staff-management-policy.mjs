import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [migration, assignments, tests, boundary, page, actions, auditTypes, manifest] =
  await Promise.all([
    read("supabase/migrations/20260728000002_clinic_staff_management.sql"),
    read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
    read("supabase/tests/database/clinic_staff_management.test.sql"),
    read("packages/database/src/clinic-staff-management.ts"),
    read("apps/web/src/app/(clinic)/clinic/staff/page.tsx"),
    read("apps/web/src/app/(clinic)/clinic/staff/actions.ts"),
    read("packages/database/src/audit/audit-types.ts"),
    read("package.json").then(JSON.parse),
  ]);

for (const assignment of [
  "('CLINIC_OWNER', 'ADMIN-PERM-003')",
  "('CLINIC_ADMIN', 'ADMIN-PERM-003')",
  "('CLINIC_OWNER', 'ROLE-007')",
  "('CLINIC_OWNER', 'ROLE-009')",
  "('CLINIC_ADMIN', 'ROLE-006')",
  "('CLINIC_ADMIN', 'ROLE-009')",
]) {
  assert(assignments.includes(assignment), `Approved assignment is missing: ${assignment}`);
}
assert(!assignments.includes("('CLINIC_ADMIN', 'ROLE-007')"));

for (const fragment of [
  "create table public.clinic_invitation (",
  "create table public.clinic_invitation_history (",
  "create table public.clinic_staff_management_history (",
  "pending', 'accepted', 'revoked', 'expired",
  "clinic_invitation_pending_email_unique",
  "provider_reference_hash",
  "CLINIC_STAFF_HISTORY_IMMUTABLE",
  "create_clinic_invitation",
  "transition_clinic_invitation",
  "accept_clinic_invitation",
  "set_clinic_membership_roles",
  "deactivate_clinic_staff",
  "bootstrap_first_clinic_owner",
  "list_clinic_staff",
  "list_pending_clinic_invitations",
  "authorization_version = authorization_version + 1",
  "force row level security",
]) {
  assert(migration.includes(fragment), `Staff-management migration is missing ${fragment}.`);
}
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(!migration.includes("grant execute"));
assert(!migration.match(/\b(patient feature|billing|branding|impersonation|support access)\b/iu));

for (const requiredTest of [
  "Clinic Administrator invites an ordinary staff role",
  "Clinic Administrator cannot invite Doctor",
  "Patient role invitation is denied",
  "resend appends immutable history",
  "old invitation reference is invalid after resend",
  "invitation acceptance is replay-safe and idempotent",
  "Clinic B cannot discover or mutate Clinic A invitation",
  "Support Engineer cannot use clinic staff flow",
  "role change increments authorization version exactly once",
  "Doctor role without verification grants no Doctor authority",
  "role catalogue remains exactly thirteen roles",
  "permission catalogue remains exactly sixty permissions",
]) {
  assert(tests.includes(requiredTest), `Staff-management coverage is missing: ${requiredTest}.`);
}

assert(boundary.includes('CLINIC_STAFF_PERMISSION = "ADMIN-PERM-003"'));
assert(boundary.includes("CLINIC_STAFF_EXPIRY_DAYS = 7"));
assert(page.includes("Clinic staff management"));
assert(page.includes("Pending invitations"));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
for (const action of [
  "invitation.accept",
  "invitation.create",
  "invitation.resend",
  "invitation.revoke",
  "membership.deactivate",
  "membership.role_assign",
  "membership.role_remove",
]) {
  assert(auditTypes.includes(`"${action}"`), `Audit type is missing ${action}.`);
}

assert.equal(
  manifest.scripts["clinic:test:staff-management"],
  "node tooling/run-local-clinic-staff-management.mjs --confirm-local-clinic-staff-management",
);
assert.equal(
  manifest.scripts["verify:clinic-staff-management-policy"],
  "node tooling/verify-clinic-staff-management-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-clinic-staff-management-policy.mjs"));

console.log(
  "Clinic staff-management policy passed: approved permissions, clinic isolation, controlled invitations, role boundaries, immutable history, and unchanged catalogues are enforced.",
);
