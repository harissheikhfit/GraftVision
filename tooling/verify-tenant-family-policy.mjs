import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (
      entry.isDirectory() &&
      ![".next", ".turbo", "coverage", "dist", "node_modules"].includes(entry.name)
    ) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

const migrationNames = (await readdir(path.join(rootDirectory, "supabase/migrations"))).filter(
  (name) => name.endsWith(".sql"),
);
assert.equal(
  migrationNames.length,
  78,
  "The tenant-policy-family migration must remain present within the current migration set.",
);
const tenantFamilyMigrationName = migrationNames.find((name) =>
  name.includes("tenant_policy_families"),
);
assert(tenantFamilyMigrationName, "The TENANT-002 migration must exist.");

const [
  migration,
  fixtureTests,
  tenantTests,
  auditTests,
  serverSource,
  serverTests,
  tenantContextSource,
  tenantTransactionSource,
  tenantErrorsSource,
  tenantIndex,
  tenantPackageTests,
  databaseIndex,
  databaseManifest,
  rootManifest,
  rootReadme,
  databaseReadme,
  supabaseReadme,
] = await Promise.all([
  read(`supabase/migrations/${tenantFamilyMigrationName}`),
  read("supabase/tests/database/tenant_policy_families.test.sql"),
  read("supabase/tests/database/tenant_isolation.test.sql"),
  read("supabase/tests/database/audit_foundation.test.sql"),
  read("packages/database/src/server.ts"),
  read("packages/database/src/server.test.ts"),
  read("packages/database/src/tenant/tenant-context.ts"),
  read("packages/database/src/tenant/tenant-transaction.ts"),
  read("packages/database/src/tenant/tenant-errors.ts"),
  read("packages/database/src/tenant/index.ts"),
  read("packages/database/src/tenant/tenant-context.test.ts"),
  read("packages/database/src/index.ts"),
  read("packages/database/package.json").then(JSON.parse),
  read("package.json").then(JSON.parse),
  read("README.md"),
  read("packages/database/README.md"),
  read("supabase/README.md"),
]);

assert(migration.toLowerCase().includes("task: tenant-002"));
assert(!/create table\b/iu.test(migration), "TENANT-002 must not create a persistent table.");
assert(!/create policy\b/iu.test(migration), "TENANT-002 adds conventions, not product policies.");
assert(!/\busing\s*\(\s*true\s*\)|disable row level security/iu.test(migration));
assert(!/\bleakproof\b/iu.test(migration));
assert(!/\bexecute\s+format\b|\bdynamic sql\b/iu.test(migration));

for (const functionName of [
  "set_tenant_context",
  "require_active_clinic_membership",
  "tenant_row_is_accessible",
  "prevent_clinic_id_change",
]) {
  assert(migration.includes(`graftvision_private.${functionName}`), `Missing ${functionName}.`);
}

for (const requiredFragment of [
  "set search_path = ''",
  "trusted tenant context cannot change within a transaction",
  "active tenant membership is required",
  "clinic ownership is immutable",
  "unique (clinic_id, id)",
  "foreign key (clinic_id, parent_id)",
  "tenant_row_is_accessible",
  "grant execute on function graftvision_private.tenant_row_is_accessible",
]) {
  assert(
    migration.toLowerCase().includes(requiredFragment.toLowerCase()),
    `Missing tenant-family contract: ${requiredFragment}.`,
  );
}

assert(
  /create function graftvision_private\.tenant_row_is_accessible[\s\S]*?language sql[\s\S]*?stable[\s\S]*?set search_path = ''/iu.test(
    migration,
  ),
);
assert(
  !/create function graftvision_private\.tenant_row_is_accessible[\s\S]*?security definer/iu.test(
    migration,
  ),
  "The boolean RLS predicate must remain security invoker.",
);
assert(
  /revoke all on function graftvision_private\.set_tenant_context[\s\S]*?from public, anon, authenticated/iu.test(
    migration,
  ),
);

for (const source of [
  tenantContextSource,
  tenantTransactionSource,
  tenantErrorsSource,
  tenantIndex,
]) {
  assert(source.startsWith('import "server-only";'));
}
assert(serverSource.includes("graftvision_private.set_tenant_context"));
assert(!serverSource.includes("graftvision_private.set_test_tenant_context"));
assert(serverTests.includes("graftvision_private.set_tenant_context"));
assert.equal(databaseManifest.exports["./tenant"].import, "./src/tenant/index.ts");
assert(databaseIndex.includes('export * from "./tenant";'));
assert(tenantTransactionSource.includes("reuseTenantTransaction"));
assert(tenantTransactionSource.includes("withTenantTransaction"));
assert(tenantContextSource.includes("TENANT_CONTEXT_SWITCH_REJECTED"));
assert(tenantPackageTests.includes("same-context reuse"));
assert(tenantPackageTests.includes("cross-clinic nested context"));
assert(tenantPackageTests.includes("audit writer composable"));

for (const requiredFixture of [
  "create temporary table tenant_boundary_parent_fixture",
  "create temporary table tenant_boundary_child_fixture",
  "unique (clinic_id, id)",
  "unique (clinic_id, local_code)",
  "foreign key (clinic_id, parent_id)",
  "prevent_clinic_id_change",
  "tenant_boundary_parent_fixture_select_active_tenant",
  "tenant_boundary_child_fixture_select_active_tenant",
  "Clinic Alpha child cannot reference a Clinic Beta parent",
  "tenant-scoped value may repeat",
  "missing trusted context",
  "suspended Clinic Beta membership",
  "context cannot switch",
  "savepoint rollback",
  "audit evidence uses the unchanged trusted tenant and actor",
]) {
  assert(
    fixtureTests.toLowerCase().includes(requiredFixture.toLowerCase()),
    `Missing tenant-family pgTAP coverage: ${requiredFixture}.`,
  );
}
assert(fixtureTests.includes("begin;") && fixtureTests.includes("rollback;"));
assert(tenantTests.includes("select plan(27);"));
assert(auditTests.includes("select plan(47);"));

assert.equal(
  rootManifest.scripts["db:test:tenant-families"],
  "supabase test db supabase/tests/database/tenant_policy_families.test.sql",
);
assert.equal(
  rootManifest.scripts["verify:tenant-family-policy"],
  "node tooling/verify-tenant-family-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-tenant-family-policy.mjs"));
assert(rootReadme.includes("## Reusable Tenant Policy Families"));
assert(databaseReadme.includes("## Reusable tenant policy families"));
assert(supabaseReadme.includes("## TENANT-002 tenant policy families"));

const applicationFiles = [
  ...(await listFiles(path.join(rootDirectory, "apps"))),
  ...(await listFiles(path.join(rootDirectory, "packages/ui"))),
].filter((file) => /\.(?:js|mjs|ts|tsx)$/u.test(file));

for (const file of applicationFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(rootDirectory, file);

  assert(
    !/set_tenant_context|set_test_tenant_context|@graftvision\/database\/tenant/iu.test(source),
    `${relative}: clients must not establish or import trusted tenant context.`,
  );
}

for (const prohibitedTable of [
  "patient",
  "consultation",
  "media",
  "report",
  "procedure",
  "follow_up",
  "subscription",
  "support_access",
  "export",
  "deletion",
]) {
  assert(
    !new RegExp(`create table\\s+(?:public\\.)?${prohibitedTable}\\b`, "iu").test(migration),
    `${prohibitedTable} is outside TENANT-002 scope.`,
  );
}

for (const dependency of ["@supabase/supabase-js", "@supabase/ssr"]) {
  const dependencies = {
    ...databaseManifest.dependencies,
    ...databaseManifest.devDependencies,
    ...rootManifest.dependencies,
    ...rootManifest.devDependencies,
  };
  assert(!Object.hasOwn(dependencies, dependency), `${dependency} remains outside scope.`);
}

console.log(
  "Tenant-family policy passed: trusted context is transaction-local and immutable, tenant relationships are composite, ownership is fixed, RLS composition is deny-safe, and product schema remains absent.",
);
