import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDatabasePackage = createRequire(
  path.join(rootDirectory, "packages/database/package.json"),
);
const { Pool } = requireFromDatabasePackage("pg");

const confirmationFlag = "--confirm-local-tenant-regression";
const defaultLocalDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const alpha = {
  clinicId: "20000000-0000-4000-8000-000000000001",
  clinicCode: "clinic-alpha",
  platformUserId: "10000000-0000-4000-8000-000000000001",
};
const beta = {
  clinicId: "20000000-0000-4000-8000-000000000002",
  clinicCode: "clinic-beta",
  platformUserId: "10000000-0000-4000-8000-000000000003",
};

class PoolRegressionError extends Error {
  constructor(message) {
    super(message);
    this.name = "PoolRegressionError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new PoolRegressionError(message);
  }
}

function resolveConnectionString(values) {
  const applicationEnvironment =
    values.APP_ENV ??
    (values.NODE_ENV === "test"
      ? "test"
      : values.NODE_ENV === undefined || values.NODE_ENV === "development"
        ? "local"
        : undefined);

  assert(
    applicationEnvironment === "local" || applicationEnvironment === "test",
    "Pool regression is permitted only in local or disposable test environments.",
  );

  const rawUrl = values.SUPABASE_DB_URL ?? defaultLocalDatabaseUrl;
  assert(URL.canParse(rawUrl), "Pool regression database configuration is invalid.");

  const databaseUrl = new URL(rawUrl);
  assert(
    databaseUrl.protocol === "postgres:" || databaseUrl.protocol === "postgresql:",
    "Pool regression requires PostgreSQL.",
  );
  assert(
    ["127.0.0.1", "::1", "localhost"].includes(databaseUrl.hostname),
    "Pool regression requires a loopback host.",
  );
  assert(databaseUrl.port === "54322", "Pool regression requires the approved local port.");
  assert(databaseUrl.pathname === "/postgres", "Pool regression requires the disposable database.");

  return rawUrl;
}

async function getContext(client) {
  const result = await client.query(
    `select
       graftvision_private.current_platform_user_id()::text as platform_user_id,
       graftvision_private.current_clinic_id()::text as clinic_id`,
  );

  return result.rows[0];
}

async function assertContextCleared(pool, label) {
  const client = await pool.connect();

  try {
    const context = await getContext(client);
    assert(
      context?.platform_user_id === null && context?.clinic_id === null,
      `${label} leaked trusted tenant context.`,
    );
  } finally {
    client.release();
  }
}

async function queryAsAuthenticated(client, statement, parameters = []) {
  await client.query("set local role authenticated");

  try {
    return await client.query(statement, parameters);
  } finally {
    await client.query("reset role");
  }
}

async function withContext(pool, context, completion, operation) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("select graftvision_private.set_tenant_context($1::uuid, $2::uuid)", [
      context.platformUserId,
      context.clinicId,
    ]);
    const result = await operation(client);
    await client.query(completion);
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function createBarrier(participantCount) {
  let readyCount = 0;
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });

  return async () => {
    readyCount += 1;

    if (readyCount === participantCount) {
      release();
    }

    await ready;
  };
}

async function verifySequentialReuse(connectionString) {
  const pool = new Pool({
    application_name: "graftvision-tenant-pool-sequential-regression",
    connectionString,
    max: 1,
  });

  try {
    const alphaCode = await withContext(pool, alpha, "commit", async (client) => {
      const result = await queryAsAuthenticated(client, "select clinic_code from public.clinic");
      return result.rows[0]?.clinic_code;
    });
    assert(alphaCode === alpha.clinicCode, "Alpha transaction did not retain Alpha context.");
    await assertContextCleared(pool, "Committed Alpha transaction");

    const betaCode = await withContext(pool, beta, "rollback", async (client) => {
      const result = await queryAsAuthenticated(client, "select clinic_code from public.clinic");
      return result.rows[0]?.clinic_code;
    });
    assert(betaCode === beta.clinicCode, "Beta transaction did not retain Beta context.");
    await assertContextCleared(pool, "Rolled-back Beta transaction");

    const failedRequestId = "92000000-0000-4000-8000-000000000001";

    try {
      await withContext(pool, alpha, "commit", async (client) => {
        await client.query(
          `select graftvision_private.write_clinic_audit_event(
            'clinic.read',
            'clinic',
            $1::uuid,
            'success',
            null,
            $2::uuid,
            'database',
            '{}'::jsonb
          )`,
          [alpha.clinicId, failedRequestId],
        );
        throw new PoolRegressionError("synthetic protected operation failed");
      });
      throw new PoolRegressionError("Failed operation unexpectedly committed.");
    } catch (error) {
      assert(
        error instanceof PoolRegressionError,
        "Failed transaction exposed an unexpected database error.",
      );
    }

    const auditResult = await pool.query(
      "select count(*)::integer as count from public.audit_event where request_id = $1::uuid",
      [failedRequestId],
    );
    assert(
      auditResult.rows[0]?.count === 0,
      "Failed transaction left audit evidence outside its rollback.",
    );
    await assertContextCleared(pool, "Failed Alpha transaction");
  } finally {
    await pool.end();
  }
}

async function verifyConcurrentIsolation(connectionString) {
  const pool = new Pool({
    application_name: "graftvision-tenant-pool-concurrent-regression",
    connectionString,
    max: 2,
  });
  const barrier = createBarrier(2);
  const requestIds = [
    "92000000-0000-4000-8000-000000000002",
    "92000000-0000-4000-8000-000000000003",
  ];

  async function inspectTenant(context, otherClinicCode, requestId) {
    return withContext(pool, context, "rollback", async (client) => {
      await barrier();

      const visible = await queryAsAuthenticated(
        client,
        "select clinic_code from public.clinic order by clinic_code",
      );
      const hidden = await queryAsAuthenticated(
        client,
        "select count(*)::integer as count from public.clinic where clinic_code = $1",
        [otherClinicCode],
      );
      const trusted = await getContext(client);
      const audit = await client.query(
        `select graftvision_private.write_clinic_audit_event(
          'clinic.read',
          'clinic',
          $1::uuid,
          'success',
          null,
          $2::uuid,
          'database',
          '{}'::jsonb
        )::text as event_id`,
        [context.clinicId, requestId],
      );
      const auditScope = await client.query(
        `select clinic_id::text, actor_platform_user_id::text
           from public.audit_event
          where request_id = $1::uuid`,
        [requestId],
      );

      return {
        auditCreated: typeof audit.rows[0]?.event_id === "string",
        auditScope: auditScope.rows[0],
        hiddenCount: hidden.rows[0]?.count,
        trusted,
        visibleCodes: visible.rows.map((row) => row.clinic_code),
      };
    });
  }

  try {
    const [alphaResult, betaResult] = await Promise.all([
      inspectTenant(alpha, beta.clinicCode, requestIds[0]),
      inspectTenant(beta, alpha.clinicCode, requestIds[1]),
    ]);

    for (const [result, context] of [
      [alphaResult, alpha],
      [betaResult, beta],
    ]) {
      assert(
        JSON.stringify(result.visibleCodes) === JSON.stringify([context.clinicCode]),
        "Concurrent connection read another clinic.",
      );
      assert(result.hiddenCount === 0, "Concurrent connection discovered another clinic.");
      assert(
        result.trusted?.clinic_id === context.clinicId &&
          result.trusted?.platform_user_id === context.platformUserId,
        "Concurrent connection received another transaction's context.",
      );
      assert(result.auditCreated, "Concurrent transaction did not create scoped audit evidence.");
      assert(
        result.auditScope?.clinic_id === context.clinicId &&
          result.auditScope?.actor_platform_user_id === context.platformUserId,
        "Concurrent audit event used another transaction's context.",
      );
    }

    const auditResult = await pool.query(
      "select count(*)::integer as count from public.audit_event where request_id = any($1::uuid[])",
      [requestIds],
    );
    assert(
      auditResult.rows[0]?.count === 0,
      "Rolled-back concurrent transactions left audit evidence.",
    );
    await Promise.all([
      assertContextCleared(pool, "Concurrent connection"),
      assertContextCleared(pool, "Concurrent connection"),
    ]);
  } finally {
    await pool.end();
  }
}

async function main() {
  const arguments_ = process.argv.slice(2);
  assert(
    arguments_.length === 1 && arguments_[0] === confirmationFlag,
    "The explicit local pool-regression confirmation is missing.",
  );

  const connectionString = resolveConnectionString(process.env);
  await verifySequentialReuse(connectionString);
  await verifyConcurrentIsolation(connectionString);
  console.log(
    "Tenant pool regression passed: commit, rollback, failure, reuse, concurrency, " +
      "tenant reads, and audit context remained transaction-local.",
  );
}

try {
  await main();
} catch (error) {
  if (error instanceof PoolRegressionError) {
    console.error(`Tenant pool regression failed: ${error.message}`);
  } else {
    console.error("Tenant pool regression failed safely; inspect the approved local test state.");
  }

  process.exitCode = 1;
}
