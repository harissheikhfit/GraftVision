import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromAuth = createRequire(path.join(rootDirectory, "packages/auth/package.json"));
const requireFromDatabase = createRequire(
  path.join(rootDirectory, "packages/database/package.json"),
);
const { createClient } = requireFromAuth("@supabase/supabase-js");
const { Pool } = requireFromDatabase("pg");
const confirmationFlag = "--confirm-local-auth-fixtures";
const fixturePassword = "GraftVision-Synthetic-Test-Only-2026!";
const fixtures = [
  ["10000000-0000-4000-8000-000000000001", "owner.alpha@example.test", true],
  ["10000000-0000-4000-8000-000000000002", "staff.alpha@example.test", true],
  ["10000000-0000-4000-8000-000000000003", "owner.beta@example.test", true],
  ["10000000-0000-4000-8000-000000000004", "staff.beta@example.test", true],
  ["10000000-0000-4000-8000-000000000005", "suspended.alpha@example.test", false],
];

class LocalAuthFixtureError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalAuthFixtureError";
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new LocalAuthFixtureError(message);
  }
}

async function localStatus() {
  const config = await readFile(path.join(rootDirectory, "supabase/config.toml"), "utf8");
  ensure(config.includes('project_id = "graftvision-local"'), "Local project marker is missing.");

  const { stdout } = await execFileAsync("supabase", ["status", "-o", "json"], {
    cwd: rootDirectory,
  });
  const status = JSON.parse(stdout);
  const apiUrl = status.API_URL;
  // The local CLI gateway currently accepts its legacy anonymous JWT for Auth
  // requests; deployed environments may use the current publishable-key format.
  const publishableKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const databaseUrl = status.DB_URL;

  for (const value of [apiUrl, publishableKey, serviceRoleKey, databaseUrl]) {
    ensure(typeof value === "string" && value.length > 0, "Local Supabase status is incomplete.");
  }

  const parsedApiUrl = new URL(apiUrl);
  const parsedDatabaseUrl = new URL(databaseUrl);
  ensure(
    ["127.0.0.1", "::1", "localhost"].includes(parsedApiUrl.hostname) &&
      parsedApiUrl.port === "54321",
    "Auth fixtures require the approved loopback API.",
  );
  ensure(
    ["127.0.0.1", "::1", "localhost"].includes(parsedDatabaseUrl.hostname) &&
      parsedDatabaseUrl.port === "54322" &&
      parsedDatabaseUrl.pathname === "/postgres",
    "Auth fixtures require the disposable local database.",
  );

  return { apiUrl, databaseUrl, publishableKey, serviceRoleKey };
}

function adminClient(status) {
  return createClient(status.apiUrl, status.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function listFixtureUsers(client) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
  ensure(!error, "Local Auth users could not be inspected.");
  return data.users.filter((user) => fixtures.some(([id]) => id === user.id));
}

async function seed(status) {
  const client = adminClient(status);
  const existing = await listFixtureUsers(client);

  for (const [id, email] of fixtures) {
    const found = existing.find((user) => user.id === id);
    const input = {
      email,
      email_confirm: true,
      password: fixturePassword,
      user_metadata: {},
    };
    const { error } = found
      ? await client.auth.admin.updateUserById(id, input)
      : await client.auth.admin.createUser({ id, ...input });
    ensure(!error, "A deterministic local Auth fixture could not be created.");
  }

  const pool = new Pool({ connectionString: status.databaseUrl, max: 1 });
  try {
    await pool.query(
      `insert into public.clinic_membership_role (clinic_membership_id, role_code)
       values
         ('30000000-0000-4000-8000-000000000001', 'CLINIC_OWNER'),
         ('30000000-0000-4000-8000-000000000002', 'DOCTOR'),
         ('30000000-0000-4000-8000-000000000003', 'CLINIC_OWNER'),
         ('30000000-0000-4000-8000-000000000004', 'DOCTOR'),
         ('30000000-0000-4000-8000-000000000005', 'CLINICAL_ASSISTANT')
       on conflict (clinic_membership_id, role_code) do nothing`,
    );
  } finally {
    await pool.end();
  }
}

async function verify(status) {
  const users = await listFixtureUsers(adminClient(status));
  ensure(users.length === fixtures.length, "Local Auth fixture count is not deterministic.");

  for (const [id, email] of fixtures) {
    const user = users.find((candidate) => candidate.id === id);
    ensure(
      user?.email === email && Boolean(user.email_confirmed_at),
      "A deterministic local Auth identity does not match its fixture.",
    );
  }

  const pool = new Pool({ connectionString: status.databaseUrl, max: 1 });

  try {
    const result = await pool.query(
      `select platform_user.id::text, platform_user.external_identity_id
       from public.platform_user
       where platform_user.id = any($1::uuid[])
       order by platform_user.id`,
      [fixtures.map(([id]) => id)],
    );
    ensure(result.rows.length === fixtures.length, "Internal Auth linkage is incomplete.");

    for (const row of result.rows) {
      const expected = fixtures.find(([id]) => id === row.id);
      ensure(
        expected?.[1] === row.external_identity_id,
        "Internal Auth linkage is not deterministic.",
      );
    }
  } finally {
    await pool.end();
  }
}

async function integration(status) {
  const client = createClient(status.apiUrl, status.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  for (const [id, email, activeClinicAccess] of [fixtures[0], fixtures[2], fixtures[4]]) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: fixturePassword,
    });
    ensure(!error && data.user?.id === id && data.session, "Synthetic local login failed.");

    const pool = new Pool({ connectionString: status.databaseUrl, max: 1 });
    try {
      const access = await pool.query(
        `select exists (
           select 1
           from public.platform_user
           join public.clinic_membership membership
             on membership.platform_user_id = platform_user.id
           join public.clinic on clinic.id = membership.clinic_id
           where platform_user.id = $1::uuid
             and lower(platform_user.external_identity_id) = lower($2)
             and platform_user.status = 'active'
             and membership.membership_status = 'active'
             and clinic.status = 'active'
         ) as allowed`,
        [id, email],
      );
      ensure(
        access.rows[0]?.allowed === activeClinicAccess,
        "Synthetic clinic access result is incorrect.",
      );
    } finally {
      await pool.end();
    }

    await client.auth.signOut({ scope: "local" });
    const afterLogout = await client.auth.getUser();
    ensure(!afterLogout.data.user, "Logout left a reusable local client session.");
  }

  const invalidPassword = await client.auth.signInWithPassword({
    email: fixtures[0][1],
    password: "Incorrect-Local-Password!",
  });
  const unknownIdentity = await client.auth.signInWithPassword({
    email: "unknown-auth-user@example.test",
    password: "Incorrect-Local-Password!",
  });
  ensure(
    invalidPassword.error && unknownIdentity.error,
    "Invalid credentials unexpectedly authenticated.",
  );
  ensure(
    invalidPassword.error.message === unknownIdentity.error.message,
    "Provider credential errors are distinguishable.",
  );
}

async function main() {
  const [mode, confirmation, ...remaining] = process.argv.slice(2);
  ensure(
    ["integration", "seed", "verify"].includes(mode) &&
      confirmation === confirmationFlag &&
      remaining.length === 0,
    "Use one approved mode with the explicit local Auth fixture confirmation.",
  );
  ensure(
    process.env.APP_ENV === undefined ||
      process.env.APP_ENV === "local" ||
      process.env.APP_ENV === "test",
    "Auth fixtures are prohibited outside local and test environments.",
  );

  const status = await localStatus();

  if (mode === "seed") {
    await seed(status);
  } else if (mode === "verify") {
    await verify(status);
  } else {
    await verify(status);
    await integration(status);
  }

  console.log(`Local Auth ${mode} passed for five deterministic synthetic identities.`);
}

try {
  await main();
} catch (error) {
  if (error instanceof LocalAuthFixtureError) {
    console.error(`Local Auth fixture check failed: ${error.message}`);
  } else {
    console.error("Local Auth fixture check failed safely; inspect the approved local stack.");
  }

  process.exitCode = 1;
}
