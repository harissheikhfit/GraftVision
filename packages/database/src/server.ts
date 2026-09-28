import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { getDatabaseEnvironment } from "@graftvision/config/env/database";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface TenantContext {
  readonly clinicId: string;
  readonly platformUserId: string;
}

export interface TenantTransaction {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface DatabaseHealth {
  readonly reachable: boolean;
}

export class DatabaseBoundaryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DatabaseBoundaryError";
  }
}

function assertUuid(value: string, field: keyof TenantContext): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${field} must be a valid UUID.`);
  }
}

export function validateTenantContext(context: TenantContext): TenantContext {
  assertUuid(context.platformUserId, "platformUserId");
  assertUuid(context.clinicId, "clinicId");

  return context;
}

export function createDatabasePool(values?: NodeJS.ProcessEnv): Pool {
  const environment = values ? getDatabaseEnvironment(values) : getDatabaseEnvironment();

  return new Pool({
    application_name: "graftvision-tenant-boundary",
    connectionString: environment.SUPABASE_DB_URL,
    idleTimeoutMillis: 10_000,
    max: 4,
  });
}

export async function checkDatabaseHealth(pool: Pool): Promise<DatabaseHealth> {
  try {
    await pool.query("select 1");
    return { reachable: true };
  } catch {
    return { reachable: false };
  }
}

export async function withLocalTenantContext<Result>(
  pool: Pool,
  context: TenantContext,
  operation: (transaction: TenantTransaction) => Promise<Result>,
): Promise<Result> {
  const trustedContext = validateTenantContext(context);
  let connection: PoolClient | undefined;

  try {
    connection = await pool.connect();
    await connection.query("begin");
    await connection.query("select graftvision_private.set_tenant_context($1::uuid, $2::uuid)", [
      trustedContext.platformUserId,
      trustedContext.clinicId,
    ]);
    const tenantConnection = connection;

    const result = await operation({
      query: <Row extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: readonly unknown[],
      ) => tenantConnection.query<Row>(text, values ? [...values] : undefined),
    });

    await connection.query("commit");
    return result;
  } catch {
    if (connection) {
      try {
        await connection.query("rollback");
      } catch {
        // A failed rollback must not expose connection or credential details.
      }
    }

    throw new DatabaseBoundaryError("Tenant-scoped database operation failed.");
  } finally {
    connection?.release();
  }
}

export async function closeDatabasePool(pool: Pool): Promise<void> {
  try {
    await pool.end();
  } catch {
    throw new DatabaseBoundaryError("Database pool could not be closed safely.");
  }
}
