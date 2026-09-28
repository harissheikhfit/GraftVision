import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDatabasePackage = createRequire(
  path.join(rootDirectory, "packages/database/package.json"),
);
const { Client } = requireFromDatabasePackage("pg");

const defaultLocalDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const confirmationFlag = "--confirm-local-synthetic-seed";
const supportedModes = new Set(["apply", "verify"]);
const expectedMigrationVersions = ["20260726081606", "20260726143000", "20260726152000"];
const expectedClinics = [
  {
    clinic_code: "clinic-alpha",
    display_name: "Clinic Alpha",
    id: "20000000-0000-4000-8000-000000000001",
    status: "active",
  },
  {
    clinic_code: "clinic-beta",
    display_name: "Clinic Beta",
    id: "20000000-0000-4000-8000-000000000002",
    status: "active",
  },
];
const expectedUsers = [
  {
    external_identity_id: "owner.alpha@example.test",
    id: "10000000-0000-4000-8000-000000000001",
    status: "active",
  },
  {
    external_identity_id: "staff.alpha@example.test",
    id: "10000000-0000-4000-8000-000000000002",
    status: "active",
  },
  {
    external_identity_id: "owner.beta@example.test",
    id: "10000000-0000-4000-8000-000000000003",
    status: "active",
  },
  {
    external_identity_id: "staff.beta@example.test",
    id: "10000000-0000-4000-8000-000000000004",
    status: "active",
  },
  {
    external_identity_id: "suspended.alpha@example.test",
    id: "10000000-0000-4000-8000-000000000005",
    status: "active",
  },
];
const expectedMemberships = [
  {
    clinic_id: "20000000-0000-4000-8000-000000000001",
    id: "30000000-0000-4000-8000-000000000001",
    membership_status: "active",
    platform_user_id: "10000000-0000-4000-8000-000000000001",
  },
  {
    clinic_id: "20000000-0000-4000-8000-000000000001",
    id: "30000000-0000-4000-8000-000000000002",
    membership_status: "active",
    platform_user_id: "10000000-0000-4000-8000-000000000002",
  },
  {
    clinic_id: "20000000-0000-4000-8000-000000000002",
    id: "30000000-0000-4000-8000-000000000003",
    membership_status: "active",
    platform_user_id: "10000000-0000-4000-8000-000000000003",
  },
  {
    clinic_id: "20000000-0000-4000-8000-000000000002",
    id: "30000000-0000-4000-8000-000000000004",
    membership_status: "active",
    platform_user_id: "10000000-0000-4000-8000-000000000004",
  },
  {
    clinic_id: "20000000-0000-4000-8000-000000000001",
    id: "30000000-0000-4000-8000-000000000005",
    membership_status: "suspended",
    platform_user_id: "10000000-0000-4000-8000-000000000005",
  },
];

class SyntheticSeedSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyntheticSeedSafetyError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new SyntheticSeedSafetyError(message);
  }
}

function normaliseRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, value]),
    ),
  );
}

function assertRows(actual, expected, label) {
  assert(
    JSON.stringify(normaliseRows(actual)) === JSON.stringify(normaliseRows(expected)),
    `${label} do not match the deterministic synthetic fixture contract.`,
  );
}

function resolveEnvironment(values) {
  const nodeEnvironment = values.NODE_ENV ?? "development";
  const applicationEnvironment =
    values.APP_ENV ??
    (nodeEnvironment === "test" ? "test" : nodeEnvironment === "development" ? "local" : undefined);

  assert(
    applicationEnvironment === "local" || applicationEnvironment === "test",
    "Synthetic seeding is permitted only in local or disposable test environments.",
  );

  const rawDatabaseUrl = values.SUPABASE_DB_URL ?? defaultLocalDatabaseUrl;
  assert(URL.canParse(rawDatabaseUrl), "Synthetic seed database configuration is invalid.");

  const databaseUrl = new URL(rawDatabaseUrl);
  assert(
    databaseUrl.protocol === "postgres:" || databaseUrl.protocol === "postgresql:",
    "Synthetic seed database configuration must use PostgreSQL.",
  );
  assert(
    ["127.0.0.1", "::1", "localhost"].includes(databaseUrl.hostname),
    "Synthetic seeding requires a loopback database host.",
  );
  assert(databaseUrl.port === "54322", "Synthetic seeding requires the approved local port.");
  assert(
    databaseUrl.pathname === "/postgres",
    "Synthetic seeding requires the disposable database.",
  );

  return {
    applicationEnvironment,
    connectionString: rawDatabaseUrl,
  };
}

async function assertRepositorySafetyMarker() {
  const config = await readFile(path.join(rootDirectory, "supabase/config.toml"), "utf8");

  assert(
    config.includes('project_id = "graftvision-local"'),
    "The approved local Supabase project marker is missing.",
  );
  assert(
    /\[db\.seed\]\s+enabled\s*=\s*true\s+sql_paths\s*=\s*\["\.\/seed\/001_tenant_foundation\.sql"\]/u.test(
      config,
    ),
    "The approved deterministic seed configuration is missing.",
  );
}

async function assertDatabaseFoundation(client) {
  const databaseResult = await client.query(
    "select current_database() as database_name, current_user as database_user",
  );
  const database = databaseResult.rows[0];

  assert(database?.database_name === "postgres", "Unexpected local database target.");
  assert(database?.database_user === "postgres", "Synthetic seed requires the local admin role.");

  const migrationResult = await client.query(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  assert(
    JSON.stringify(migrationResult.rows.map((row) => row.version)) ===
      JSON.stringify(expectedMigrationVersions),
    "The local migration history does not match the approved foundation.",
  );

  const tableResult = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name in ('platform_user', 'clinic', 'clinic_membership', 'audit_event')
      order by table_name`,
  );
  assert(
    tableResult.rows.length === 4,
    "The required tenant and audit foundation tables are unavailable.",
  );
}

async function countAuditRows(client) {
  const result = await client.query("select count(*)::integer as count from public.audit_event");
  return result.rows[0]?.count;
}

async function verifySyntheticBaseline(client) {
  const clinics = await client.query(
    `select id::text, clinic_code, display_name, status
         from public.clinic
        where id::text like '20000000-0000-4000-8000-00000000000_'
        order by id`,
  );
  const users = await client.query(
    `select id::text, external_identity_id, status
         from public.platform_user
        where id::text like '10000000-0000-4000-8000-00000000000_'
        order by id`,
  );
  const memberships = await client.query(
    `select id::text, clinic_id::text, platform_user_id::text, membership_status
         from public.clinic_membership
        where id::text like '30000000-0000-4000-8000-00000000000_'
        order by id`,
  );
  const rowSecurity = await client.query(
    `select relname, relrowsecurity, relforcerowsecurity
         from pg_class
        where oid in (
          'public.platform_user'::regclass,
          'public.clinic'::regclass,
          'public.clinic_membership'::regclass,
          'public.audit_event'::regclass
        )
        order by relname`,
  );
  const roleTables = await client.query(
    `select count(*)::integer as count
         from information_schema.tables
        where table_schema = 'public'
          and table_name in ('role', 'roles', 'permission', 'permissions', 'role_assignment')`,
  );

  assertRows(clinics.rows, expectedClinics, "Synthetic clinics");
  assertRows(users.rows, expectedUsers, "Synthetic platform users");
  assertRows(memberships.rows, expectedMemberships, "Synthetic memberships");
  assert(
    users.rows.every((row) => row.external_identity_id.endsWith("@example.test")),
    "Synthetic identities must use the reserved testing domain.",
  );
  assert(
    rowSecurity.rows.length === 4 &&
      rowSecurity.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity),
    "RLS must remain enabled and forced on the tenant and audit foundation.",
  );
  assert(roleTables.rows[0]?.count === 0, "The synthetic seed must not create a role system.");

  const authTable = await client.query("select to_regclass('auth.users')::text as table_name");

  if (authTable.rows[0]?.table_name) {
    const authUsers = await client.query("select count(*)::integer as count from auth.users");
    assert(authUsers.rows[0]?.count === 0, "The synthetic seed must not create Auth users.");
  }

  return {
    clinics: clinics.rows.length,
    memberships: memberships.rows.length,
    users: users.rows.length,
  };
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const mode = arguments_.find((argument) => !argument.startsWith("-"));
  const unknownArguments = arguments_.filter(
    (argument) => argument !== mode && argument !== confirmationFlag,
  );

  assert(mode && supportedModes.has(mode), "Use the apply or verify seed mode.");
  assert(arguments_.includes(confirmationFlag), "The explicit local seed confirmation is missing.");
  assert(unknownArguments.length === 0, "Unsupported synthetic seed arguments were supplied.");

  const environment = resolveEnvironment(process.env);
  await assertRepositorySafetyMarker();

  const client = new Client({
    application_name: "graftvision-synthetic-seed",
    connectionString: environment.connectionString,
    connectionTimeoutMillis: 5_000,
  });

  try {
    await client.connect();
    await assertDatabaseFoundation(client);

    const auditCountBefore = await countAuditRows(client);

    if (mode === "apply") {
      const seedSql = await readFile(
        path.join(rootDirectory, "supabase/seed/001_tenant_foundation.sql"),
        "utf8",
      );
      await client.query(seedSql);
    }

    const counts = await verifySyntheticBaseline(client);
    const auditCountAfter = await countAuditRows(client);
    assert(
      auditCountAfter === auditCountBefore,
      "Synthetic fixture setup must not create or mutate audit evidence.",
    );

    console.log(
      `Synthetic seed ${mode === "apply" ? "applied and verified" : "verified"}: ` +
        `${counts.clinics} clinics, ${counts.users} platform users, ` +
        `${counts.memberships} memberships; environment=${environment.applicationEnvironment}.`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SyntheticSeedSafetyError) {
    console.error(`Synthetic seed rejected: ${error.message}`);
  } else if (error?.code === "23505") {
    console.error("Synthetic seed rejected: fixture identifiers conflict with existing records.");
  } else {
    console.error("Synthetic seed failed safely; inspect the approved local database state.");
  }

  process.exitCode = 1;
}
