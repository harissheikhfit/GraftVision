import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [manifest, rbacAuth, rbacDatabase, auditTypes] = await Promise.all([
  read("package.json").then(JSON.parse),
  read("packages/auth/src/server/rbac.ts"),
  read("packages/database/src/rbac.ts"),
  read("packages/database/src/audit/audit-types.ts"),
]);

const migrationsDir = path.join(root, "supabase/migrations");
const files = await readdir(migrationsDir);
const rbacMigrationFile = files.find((f) => f.includes("rbac_foundation"));
const rbacHardeningMigrationFiles = files.filter(
  (file) =>
    file.includes("rbac_authority_hardening") ||
    file.includes("rbac_lookup_policy_hardening") ||
    file.includes("rbac_authority_scope"),
);
assert(rbacMigrationFile, "RBAC foundation migration not found");
assert(rbacHardeningMigrationFiles.length > 0, "RBAC hardening migration not found");

const rbacMigration = await read(`supabase/migrations/${rbacMigrationFile}`);
const rbacHardeningMigration = (
  await Promise.all(rbacHardeningMigrationFiles.map((file) => read(`supabase/migrations/${file}`)))
).join("\n");
const pgTapTests = await read("supabase/tests/database/rbac_authority.test.sql").catch(() => "");

// 1. Must use lookup tables, not enums
assert(
  !rbacMigration.toLowerCase().includes("create type role_code as enum"),
  "PostgreSQL enums are forbidden for role catalogue",
);
assert(
  !rbacMigration.toLowerCase().includes("create type permission_id as enum"),
  "PostgreSQL enums are forbidden for permission catalogue",
);
assert(
  rbacMigration.includes("create table public.role_definition"),
  "Missing role_definition table",
);
assert(
  rbacMigration.includes("create table public.permission_definition"),
  "Missing permission_definition table",
);

// 2. Database-authoritative role_permission decisions
assert(
  rbacHardeningMigration.includes("insert into public.role_permission"),
  "Must insert role permissions natively",
);
assert(
  !rbacAuth.includes("ROLE_PERMISSIONS:"),
  "No independent runtime permission matrix allowed in rbac.ts",
);
assert(
  rbacAuth.includes("graftvision_private.has_application_session_permission"),
  "rbac.ts must query database for permissions",
);
assert(
  rbacHardeningMigration.includes("graftvision_private.has_application_session_permission"),
  "Must have DB function for permission check",
);

// 3. Active user/clinic/membership checks
assert(rbacHardeningMigration.includes("u.status = 'active'"), "Must check user active status");
assert(rbacHardeningMigration.includes("c.status = 'active'"), "Must check clinic active status");
assert(
  rbacHardeningMigration.includes("m.membership_status = 'active'"),
  "Must check membership active status",
);

// 4. Trusted actor derivation & no caller-authoritative actorContext
assert(
  rbacHardeningMigration.includes("graftvision_private.current_platform_user_id()"),
  "Must derive actor natively",
);
assert(
  !rbacDatabase.includes("actorContext: PermissionEvaluationContext"),
  "Mutation functions must not take actorContext",
);
assert(
  !rbacDatabase.includes("requirePermission"),
  "No auth/database package cycle allowed in mutation functions",
);

// 5. Full tuple parity test
assert(
  pgTapTests.includes("select role_code, permission_id from expected_role_permissions"),
  "Missing full tuple parity pgTAP test",
);

// 6. Cross-clinic and self-escalation tests
assert(pgTapTests.includes("cannot assign CLINIC_OWNER"), "Missing self-escalation test");
assert(
  pgTapTests.includes("cannot assign platform roles"),
  "Missing cross-clinic to platform test",
);

// 7. Version/audit atomicity
assert(rbacDatabase.includes("writeAuditEvent"), "Missing atomic audit event in DB assignment");
assert(
  rbacDatabase.includes("authorization_version"),
  "Missing atomic version increment in DB assignment",
);

// 8. Patient staff assignment prevention
assert(
  rbacMigration.includes("prevent_patient_role_assignment"),
  "Missing prevention of patient staff assignment",
);

// 9. Audit taxonomy
assert(auditTypes.includes("role.assign"), "Missing role.assign audit action");
assert(auditTypes.includes("role.remove"), "Missing role.remove audit action");
assert(
  auditTypes.includes("authorization.version_increment"),
  "Missing version increment audit action",
);

// 10. Verify script is in check command
assert(
  manifest.scripts.check.includes("verify-rbac-foundation-policy.mjs"),
  "check script must run rbac policy verifier",
);

console.log(
  "RBAC foundation policy passed: Authoritative DB permissions, active-state denial, native boundaries, atomicity, and parity testing verified.",
);
