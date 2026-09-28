import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

const migrationNames = (await readdir(path.join(rootDirectory, "supabase/migrations"))).filter(
  (name) => name.endsWith(".sql"),
);
assert.equal(
  migrationNames.length,
  78,
  "The tenant foundation must remain present within the current additive migrations.",
);
const tenantMigrationName = migrationNames.find((name) => name.includes("tenant_foundation"));
assert(tenantMigrationName, "The TENANT-001 migration must remain present.");

const [migration, test, config, database, databaseManifest, rootManifest, template] =
  await Promise.all([
    read(`supabase/migrations/${tenantMigrationName}`),
    read("supabase/tests/database/tenant_isolation.test.sql"),
    read("supabase/config.toml"),
    read("packages/database/src/server.ts"),
    read("packages/database/package.json").then(JSON.parse),
    read("package.json").then(JSON.parse),
    read(".env.example"),
  ]);

assert(migration.toLowerCase().includes("task: tenant-001"));

for (const table of ["platform_user", "clinic", "clinic_membership"]) {
  assert(
    new RegExp(`create table public\\.${table}\\b`, "iu").test(migration),
    `${table} must be created by TENANT-001.`,
  );
  assert(
    new RegExp(`alter table public\\.${table}\\s+enable row level security`, "iu").test(migration),
    `${table} must enable RLS.`,
  );
  assert(
    new RegExp(`alter table public\\.${table}\\s+force row level security`, "iu").test(migration),
    `${table} must force RLS.`,
  );
}

for (const requiredFragment of [
  "current_platform_user_id",
  "current_clinic_id",
  "has_active_clinic_membership",
  "set_test_tenant_context",
  "clear_test_tenant_context",
  "clinic_membership_clinic_user_unique",
  "clinic_code_case_insensitive_unique",
  "clinic_membership_user_status_clinic_idx",
  "on delete restrict",
  "security definer",
  "set search_path = ''",
]) {
  assert(migration.toLowerCase().includes(requiredFragment.toLowerCase()));
}

assert.equal((migration.match(/create policy /giu) ?? []).length, 12);
assert(!/\busing\s*\(\s*true\s*\)/iu.test(migration), "Broad USING (true) is prohibited.");
assert(!/\bdisable row level security\b/iu.test(migration), "RLS disablement is prohibited.");
assert(
  !/create table\s+(?:public\.)?(?:patient|consultation|report|procedure|media|scan|followup)\b/iu.test(
    migration,
  ),
  "Clinical or later-phase tables are outside TENANT-001 scope.",
);

for (const requiredTest of [
  "Clinic Alpha",
  "Clinic Beta",
  "missing tenant context",
  "cross-clinic",
  "suspended",
  "savepoint",
  "rollback",
  "case-insensitive",
  "restrictive deletion relationships",
]) {
  assert(test.toLowerCase().includes(requiredTest.toLowerCase()));
}
assert(!/(?:FACE Aesthetic|Sheraz|patient)/iu.test(test), "Database tests must remain synthetic.");
assert(test.includes("begin;") && test.includes("rollback;"));

for (const service of ["realtime", "storage", "studio", "analytics", "edge_runtime"]) {
  assert(new RegExp(`\\[${service}\\][\\s\\S]*?enabled\\s*=\\s*false`, "u").test(config));
}
assert(/\[api\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(/\[auth\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(!config.includes("project_ref"));

assert(database.startsWith('import "server-only";'));
assert(database.includes("graftvision_private.set_tenant_context"));
assert(database.includes('"begin"') && database.includes('"commit"'));
assert.equal(databaseManifest.dependencies.pg, "8.22.0");
assert.equal(rootManifest.devDependencies.supabase, "2.109.1");
assert.equal(rootManifest.scripts["db:test"], "supabase test db");
assert.equal(rootManifest.scripts["db:reset"], "supabase db reset --local");
assert(rootManifest.scripts.check.includes("node tooling/verify-tenant-policy.mjs"));
assert(template.includes("127.0.0.1:54322"));

for (const forbidden of [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  assert(!template.includes(forbidden));
}

console.log(
  "Tenant policy passed: the three-table local PostgreSQL foundation remains deny-by-default, tenant-scoped, synthetic-test covered, and unlinked from remote services while local Auth is enabled.",
);
