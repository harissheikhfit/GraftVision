import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const names = await readdir(path.join(root, "supabase/migrations"));
assert(names.includes("20260729000004_platform_admin_console.sql"));
assert(names.includes("20260729000005_platform_admin_operational_controls.sql"));
const [
  migration,
  operational,
  tests,
  bootstrap,
  page,
  dashboard,
  actions,
  boundary,
  manifest,
  env,
] = await Promise.all([
  read("supabase/migrations/20260729000004_platform_admin_console.sql"),
  read("supabase/migrations/20260729000005_platform_admin_operational_controls.sql"),
  read("supabase/tests/database/platform_admin.test.sql"),
  read("tooling/bootstrap-platform-owner.mjs"),
  read("apps/web/src/app/(platform)/platform/page.tsx"),
  read("apps/web/src/app/(platform)/platform/platform-dashboard.tsx"),
  read("apps/web/src/app/(platform)/platform/actions.ts"),
  read("packages/database/src/platform-admin.ts"),
  read("package.json").then(JSON.parse),
  read(".env.example"),
]);
for (const fragment of [
  "ADMIN-PERM-007",
  "('PLATFORM_OWNER', 'ADMIN-PERM-007')",
  "bootstrap_first_platform_owner",
  "PLATFORM_OWNER_ALREADY_EXISTS",
  "has_platform_owner_admin_authority",
  "authority_scope = 'platform'",
  "read_platform_dashboard",
  "update_platform_clinic_metadata",
  "manage_platform_clinic_administrator",
  "read_platform_audit",
  "platform_admin_history_immutable",
  "revoke all on table public.platform_admin_history",
])
  assert(migration.includes(fragment), `Missing platform admin policy: ${fragment}`);
assert(!migration.includes("('PLATFORM_ADMIN', 'ADMIN-PERM-007')"));
assert(!migration.includes("('PLATFORM_SUPPORT', 'ADMIN-PERM-007')"));
assert(
  !migration.match(/insert into public\.clinic_membership[\s\S]{0,200}p_provider_identity_id/iu),
);
for (const prohibited of [
  "patient_number",
  "full_name",
  "consultation",
  "clinical_note",
  "impersonat",
]) {
  assert(!migration.toLowerCase().includes(prohibited), `Prohibited platform scope: ${prohibited}`);
}
for (const evidence of [
  "first owner bootstrap succeeds",
  "same owner bootstrap is idempotent",
  "different owner is refused",
  "no Platform Administrator is assigned initially",
  "Support is denied the platform console",
  "owner receives no implicit clinic membership",
  "Platform Owner receives no patient permission",
  "administrative history is immutable",
])
  assert(tests.includes(evidence), `Missing platform test: ${evidence}`);
assert(bootstrap.includes("hiddenPassword"));
assert(bootstrap.includes('if (environment === "production")'));
assert(bootstrap.includes('args.indexOf("--email")'));
assert(!env.match(/PASSWORD\s*=/iu));
assert(page.includes("Platform administration") && dashboard.includes("Create clinic"));
assert(actions.includes('requireVerifiedAuthSession(client, "platform")'));
assert(boundary.includes('PLATFORM_CLINIC_ADMIN_PERMISSION = "ADMIN-PERM-007"'));
for (const fragment of [
  "manage_platform_user_lifecycle",
  "FINAL_PLATFORM_OWNER_PROTECTED",
  "pg_advisory_xact_lock",
  "'ADMIN-PERM-004'",
  "revoke_platform_user_sessions",
  "read_platform_session_health",
  "'TENANT-ACCESS-002'",
  "read_filtered_platform_audit",
  "'AUDIT-PERM-001'",
  "platform_operational_history_immutable",
])
  assert(operational.includes(fragment), `Missing operational policy: ${fragment}`);
for (const prohibited of [
  "access_token",
  "refresh_token",
  "password_hash",
  "raw_user_agent",
  "patient_name",
])
  assert(!operational.includes(prohibited), `Prohibited projection: ${prohibited}`);
for (const label of [
  "Suspend clinic",
  "Mark clinic inactive",
  "Replace administrator",
  "Remove administrator",
  "Deactivate",
  "Revoke session",
  "Revoke sessions",
])
  assert(dashboard.includes(label), `Missing high-risk confirmation: ${label}`);
assert(dashboard.includes("Recent platform audit"));
assert(dashboard.includes("Platform session health"));
assert.equal(
  manifest.scripts["platform:bootstrap-owner"],
  "node tooling/bootstrap-platform-owner.mjs",
);
assert.equal(
  manifest.scripts["platform:test:admin"],
  "node tooling/run-local-platform-admin.mjs --confirm-local-platform-admin",
);
assert.equal(
  manifest.scripts["verify:platform-admin-policy"],
  "node tooling/verify-platform-admin-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-platform-admin-policy.mjs"));
console.log(
  "Platform admin policy passed: one guarded owner, bounded clinic administration, redacted projections, targeted authority, and patient/clinical denial are enforced.",
);
