import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
  migration,
  boundaryTests,
  authorityTests,
  authRbac,
  authSession,
  registry,
  proxy,
  auditTypes,
  manifest,
] = await Promise.all([
  read("supabase/migrations/20260727000004_rbac_authority_scope.sql"),
  read("supabase/tests/database/rbac_boundary.test.sql"),
  read("supabase/tests/database/rbac_authority.test.sql"),
  read("packages/auth/src/server/rbac.ts"),
  read("packages/auth/src/server/session.ts"),
  read("packages/auth/src/server/registry.ts"),
  read("packages/auth/src/server/proxy.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("package.json").then(JSON.parse),
]);

for (const fragment of [
  "add column authority_scope text",
  "application_session_scope_clinic_check",
  "is_platform_metadata_permission",
  "has_application_session_permission",
  "rotate_application_session_authority",
  "ACTIVE_PLATFORM_ROLE_REQUIRED",
  "ACTIVE_CLINIC_ROLE_REQUIRED",
  "authority.cross_scope_denied",
  "authority.scope_change",
]) {
  assert(migration.includes(fragment), `RBAC-002 migration is missing ${fragment}.`);
}

assert(!/authority_scope\s+text\s+default/iu.test(migration), "Authority scope must be explicit.");
assert(
  migration.includes("rd.role_type = 'platform'") && migration.includes("rd.role_type = 'clinic'"),
  "Permission evaluation must preserve platform/clinic role separation.",
);

const allowlistedPermissions = [
  "TENANT-ACCESS-002",
  "ADMIN-PERM-004",
  "ADMIN-PERM-005",
  "ADMIN-PERM-006",
  "AUDIT-PERM-001",
  "ROLE-010",
  "EXPORT-PERM-002",
  "SUPPORT-PERM-002",
  "SUPPORT-PERM-003",
];
for (const permission of allowlistedPermissions) {
  assert(migration.includes(`'${permission}'`), `Platform allowlist is missing ${permission}.`);
}

for (const prohibited of [
  "support grant",
  "impersonation",
  "break-glass",
  "tenant switching",
  "temporary clinical access",
]) {
  assert(
    !migration.toLowerCase().includes(prohibited),
    `RBAC-002 implements prohibited ${prohibited}.`,
  );
}

assert(authRbac.includes("has_application_session_permission"));
assert(!authRbac.includes("platformUserId"));
assert(authSession.includes("appSession.platformUserId === data.claims.sub"));
assert(registry.includes('authorityScope: "clinic"'));
assert(registry.includes('authorityScope: "platform"'));
assert(proxy.includes("appSession.authorityScope === requiredScope"));

for (const unsafeAuthoritySource of ["user_metadata", "app_metadata", "role claim"]) {
  assert(
    ![authRbac, authSession, registry, proxy].some((source) =>
      source.toLowerCase().includes(unsafeAuthoritySource),
    ),
    `Authority must not trust ${unsafeAuthoritySource}.`,
  );
}

for (const requiredTest of [
  "platform session is denied clinic data",
  "clinic session is denied platform administration",
  "combined-role user succeeds only in the matching clinic session",
  "forged provider identity is denied",
  "Clinic A session is denied Clinic B",
  "support engineer is denied tenant and clinical data",
  "null clinic context never implies platform authority",
  "scope switch revokes the previous session",
  "role catalogue remains exactly thirteen roles",
  "permission catalogue remains exactly sixty permissions",
]) {
  assert(
    boundaryTests.includes(requiredTest),
    `RBAC-002 test coverage is missing: ${requiredTest}.`,
  );
}

assert(authorityTests.includes("Exactly 13 approved roles"));
assert(authorityTests.includes("Exactly 60 approved permissions"));
assert(auditTypes.includes('"authority.cross_scope_denied"'));
assert(auditTypes.includes('"authority.scope_change"'));

for (const sensitiveLogTerm of [
  "access_token",
  "refresh_token",
  "cookie",
  "patient data",
  "request body",
]) {
  assert(
    !migration.toLowerCase().includes(sensitiveLogTerm),
    `RBAC-002 audit SQL must not include ${sensitiveLogTerm}.`,
  );
}

assert.equal(
  manifest.scripts["verify:rbac-boundary-policy"],
  "node tooling/verify-rbac-boundary-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-rbac-boundary-policy.mjs"));

console.log(
  "RBAC boundary policy passed: explicit scoped sessions, narrow platform metadata, server/database authority, audited cross-scope denial, and support deny-by-default are enforced.",
);
