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

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`GraftVision synthetic seed policy verifier

Usage:
  corepack pnpm verify:seed-policy

Checks deterministic seed identifiers and records, local-only execution guards,
idempotency and conflict behavior, reset integration, RLS/audit preservation,
synthetic pgTAP coverage, documentation, and absence of product/Auth/role scope.`);
  process.exit(0);
}

const seedDirectory = path.join(rootDirectory, "supabase/seed");
const seedSqlFiles = (await readdir(seedDirectory)).filter((name) => name.endsWith(".sql"));
assert.deepEqual(
  seedSqlFiles,
  ["001_tenant_foundation.sql"],
  "TENANT-003 must have one ordered SQL seed file.",
);

const [
  seed,
  seedReadme,
  seedTests,
  config,
  runner,
  rootManifest,
  databaseManifest,
  rootReadme,
  databaseReadme,
  supabaseReadme,
  tenantTests,
  tenantFamilyTests,
  auditTests,
] = await Promise.all([
  read("supabase/seed/001_tenant_foundation.sql"),
  read("supabase/seed/README.md"),
  read("supabase/tests/database/synthetic_seed_foundation.test.sql"),
  read("supabase/config.toml"),
  read("tooling/run-synthetic-seed.mjs"),
  read("package.json").then(JSON.parse),
  read("packages/database/package.json").then(JSON.parse),
  read("README.md"),
  read("packages/database/README.md"),
  read("supabase/README.md"),
  read("supabase/tests/database/tenant_isolation.test.sql"),
  read("supabase/tests/database/tenant_policy_families.test.sql"),
  read("supabase/tests/database/audit_foundation.test.sql"),
]);

const migrationNames = (await readdir(path.join(rootDirectory, "supabase/migrations"))).filter(
  (name) => name.endsWith(".sql"),
);
assert.equal(migrationNames.length, 81, "Migration scope must match the approved task sequence.");

for (const requiredMarker of [
  "Task: TENANT-003",
  "Disposable local/test tenant fixtures only",
  "begin;",
  "commit;",
  "set local lock_timeout",
  "set local statement_timeout",
  "on conflict (id) do nothing",
  "synthetic seed platform-user identity conflict",
  "synthetic seed clinic identity conflict",
  "synthetic seed membership identity conflict",
]) {
  assert(seed.toLowerCase().includes(requiredMarker.toLowerCase()), `Missing ${requiredMarker}.`);
}

for (let index = 1; index <= 5; index += 1) {
  const suffix = String(index).padStart(12, "0");
  assert(seed.includes(`10000000-0000-4000-8000-${suffix}`));
  assert(seed.includes(`30000000-0000-4000-8000-${suffix}`));
}

for (let index = 1; index <= 2; index += 1) {
  const suffix = String(index).padStart(12, "0");
  assert(seed.includes(`20000000-0000-4000-8000-${suffix}`));
}

for (const identity of [
  "owner.alpha@example.test",
  "staff.alpha@example.test",
  "owner.beta@example.test",
  "staff.beta@example.test",
  "suspended.alpha@example.test",
]) {
  assert(seed.includes(identity), `Missing synthetic identity ${identity}.`);
}

const clinicInsert =
  /insert into public\.clinic \(id, clinic_code, display_name, status\)([\s\S]*?)on conflict \(id\) do nothing;/iu.exec(
    seed,
  )?.[1];
const userInsert =
  /insert into public\.platform_user \(id, external_identity_id, status\)([\s\S]*?)on conflict \(id\) do nothing;/iu.exec(
    seed,
  )?.[1];
const membershipInsert =
  /insert into public\.clinic_membership \([\s\S]*?\)\s*values([\s\S]*?)on conflict \(id\) do nothing;/iu.exec(
    seed,
  )?.[1];

assert(clinicInsert, "The explicit clinic insert is missing.");
assert(userInsert, "The explicit platform-user insert is missing.");
assert(membershipInsert, "The explicit membership insert is missing.");
assert.equal((clinicInsert.match(/'clinic-(?:alpha|beta)'/gu) ?? []).length, 2);
assert.equal((clinicInsert.match(/'Clinic (?:Alpha|Beta)'/gu) ?? []).length, 2);
assert.equal((userInsert.match(/@example\.test'/gu) ?? []).length, 5);
assert.equal(new Set(membershipInsert.match(/30000000-0000-4000-8000-00000000000[1-5]/gu)).size, 5);
assert.equal((membershipInsert.match(/'suspended'/gu) ?? []).length, 1);

const executableSeed = seed
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

assert(
  !/^\s*(?:alter|create|delete|drop|grant|revoke|truncate|update)\b/imu.test(executableSeed),
  "Seeds must not alter schema, policy, privileges, or existing records.",
);
assert(!/\b(?:auth\.users|password|credential|service_role)\b/iu.test(executableSeed));
assert(
  !/\b(?:patient|consultation|procedure|follow_up|media|report|scan|presentation|subscription|support_access|export|deletion)\b/iu.test(
    executableSeed,
  ),
  "Product and clinical seed records are prohibited.",
);
assert(
  !/\b(?:role|roles|permission|permissions|role_assignment)\b/iu.test(executableSeed),
  "Role and permission seed data are prohibited.",
);
assert(!/(?:FACE Aesthetic|Dr Sheraz|Haris Liaqat)/iu.test(seed));
assert(!/\bdisable row level security\b|\busing\s*\(\s*true\s*\)/iu.test(seed));

assert(
  /\[db\.seed\]\s+enabled\s*=\s*true\s+sql_paths\s*=\s*\["\.\/seed\/001_tenant_foundation\.sql"\]/u.test(
    config,
  ),
);
assert.equal(rootManifest.scripts["db:reset"], "supabase db reset --local");
assert.equal(
  rootManifest.scripts["db:seed"],
  "node tooling/run-synthetic-seed.mjs apply --confirm-local-synthetic-seed",
);
assert.equal(
  rootManifest.scripts["db:seed:verify"],
  "node tooling/run-synthetic-seed.mjs verify --confirm-local-synthetic-seed",
);
assert.equal(
  rootManifest.scripts["db:test:seed"],
  "supabase test db supabase/tests/database/synthetic_seed_foundation.test.sql",
);
assert.equal(rootManifest.scripts["verify:seed-policy"], "node tooling/verify-seed-policy.mjs");
assert(rootManifest.scripts.check.includes("node tooling/verify-seed-policy.mjs"));
assert(
  !Object.keys(rootManifest.scripts).some((name) =>
    /production.*seed|seed.*production/iu.test(name),
  ),
);

for (const runnerContract of [
  '"local" || applicationEnvironment === "test"',
  '["127.0.0.1", "::1", "localhost"]',
  'databaseUrl.port === "54322"',
  'databaseUrl.pathname === "/postgres"',
  'project_id = "graftvision-local"',
  "expectedMigrationVersions",
  "auditCountAfter === auditCountBefore",
  "row.relrowsecurity && row.relforcerowsecurity",
  "fixture identifiers conflict with existing records",
  "The explicit local seed confirmation is missing",
]) {
  assert(runner.includes(runnerContract), `Missing seed-runner guard: ${runnerContract}.`);
}
assert(!/console\.(?:log|error)\([^)]*(?:connectionString|SUPABASE_DB_URL)/u.test(runner));

for (const requiredTest of [
  "select plan(36);",
  "Clinic Alpha exists",
  "Clinic Beta exists",
  "example.test domain",
  "suspended-membership scenario",
  "no unexpected cross-clinic",
  "no role or permission",
  "RLS remains enabled",
  "RLS remains forced",
  "missing context",
  "Alpha Owner accesses Clinic Alpha",
  "Alpha Owner cannot access Clinic Beta",
  "Beta Owner accesses Clinic Beta",
  "Beta Owner cannot access Clinic Alpha",
  "Alpha Staff accesses Clinic Alpha",
  "Beta Staff accesses Clinic Beta",
  "suspended member cannot access",
  "audit-row immutability",
  "deterministic seed count",
]) {
  assert(
    seedTests.toLowerCase().includes(requiredTest.toLowerCase()),
    `Missing synthetic seed pgTAP coverage: ${requiredTest}.`,
  );
}
assert(seedTests.includes("begin;") && seedTests.includes("rollback;"));
assert(tenantTests.includes("select plan(27);"));
assert(tenantFamilyTests.includes("select plan(29);"));
assert(auditTests.includes("select plan(47);"));

for (const requiredDocumentation of [
  "Synthetic-only rule",
  "Stable identifiers",
  "not Supabase Auth users",
  "Production execution is prohibited",
  "Idempotency and conflicts",
]) {
  assert(seedReadme.includes(requiredDocumentation));
}
assert(rootReadme.includes("## Synthetic Two-Clinic Seed"));
assert(supabaseReadme.includes("## TENANT-003 synthetic tenant seed"));
assert(databaseReadme.includes("## Synthetic tenant fixtures"));

const allDependencies = {
  ...rootManifest.dependencies,
  ...rootManifest.devDependencies,
  ...databaseManifest.dependencies,
  ...databaseManifest.devDependencies,
};
for (const prohibitedDependency of [
  "@faker-js/faker",
  "@supabase/ssr",
  "@supabase/supabase-js",
  "dotenv",
]) {
  assert(!Object.hasOwn(allDependencies, prohibitedDependency));
}

const applicationFiles = [
  ...(await listFiles(path.join(rootDirectory, "apps"))),
  ...(await listFiles(path.join(rootDirectory, "packages/ui"))),
].filter((file) => /\.(?:js|mjs|ts|tsx)$/u.test(file));

for (const file of applicationFiles) {
  const source = await readFile(file, "utf8");
  assert(!/synthetic.seed|@example\.test|10000000-0000-4000-8000/iu.test(source));
}

console.log(
  "Seed policy passed: two deterministic synthetic clinics, five internal users, five memberships, " +
    "local-only guarded execution, idempotent replay, preserved RLS/audit controls, and no Auth, " +
    "role, patient, clinical, remote, or production scope.",
);
