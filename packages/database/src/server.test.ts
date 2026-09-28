import { describe, expect, it, vi } from "vitest";

import {
  DatabaseBoundaryError,
  checkDatabaseHealth,
  closeDatabasePool,
  validateTenantContext,
  withLocalTenantContext,
} from "./server";

import type { Pool, PoolClient, QueryResult } from "pg";

const context = {
  clinicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  platformUserId: "11111111-1111-4111-8111-111111111111",
} as const;

function createPoolFixture(options: { readonly failAt?: string } = {}) {
  const queries: Array<{ readonly text: string; readonly values?: readonly unknown[] }> = [];
  const query = vi.fn((text: string, values?: readonly unknown[]) => {
    queries.push(values ? { text, values } : { text });

    if (options.failAt === text) {
      return Promise.reject(new Error("postgresql://user:secret@db.example.test/private"));
    }

    return Promise.resolve({ rows: [] } as unknown as QueryResult);
  });
  const release = vi.fn();
  const connection = { query, release } as unknown as PoolClient;
  const connect = vi.fn(() => Promise.resolve(connection));
  const end = vi.fn(() => Promise.resolve());
  const pool = {
    connect,
    end,
    query,
  } as unknown as Pool;

  return { connect, end, pool, queries, release };
}

describe("database server boundary", () => {
  it("validates trusted tenant identifiers before acquiring a connection", async () => {
    const { connect, pool } = createPoolFixture();

    await expect(
      withLocalTenantContext(
        pool,
        { clinicId: "not-a-uuid", platformUserId: context.platformUserId },
        () => Promise.resolve(),
      ),
    ).rejects.toThrowError(/clinicId must be a valid UUID/);
    expect(connect).not.toHaveBeenCalled();
  });

  it("uses a transaction-local trusted context and releases the connection", async () => {
    const { pool, queries, release } = createPoolFixture();

    const result = await withLocalTenantContext(pool, context, async (transaction) => {
      await transaction.query("select clinic_code from public.clinic");
      return "complete";
    });

    expect(result).toBe("complete");
    expect(queries).toEqual([
      { text: "begin" },
      {
        text: "select graftvision_private.set_tenant_context($1::uuid, $2::uuid)",
        values: [context.platformUserId, context.clinicId],
      },
      { text: "select clinic_code from public.clinic" },
      { text: "commit" },
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("establishes fresh context for sequential pool operations", async () => {
    const { connect, pool, queries, release } = createPoolFixture();
    const betaContext = {
      clinicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      platformUserId: "22222222-2222-4222-8222-222222222222",
    };

    await withLocalTenantContext(pool, context, () => Promise.resolve());
    await withLocalTenantContext(pool, betaContext, () => Promise.resolve());

    expect(connect).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
    expect(queries.filter(({ text }) => text === "begin")).toHaveLength(2);
    expect(queries.filter(({ text }) => text === "commit")).toHaveLength(2);
    expect(queries.filter(({ text }) => text.includes("set_tenant_context"))).toEqual([
      {
        text: "select graftvision_private.set_tenant_context($1::uuid, $2::uuid)",
        values: [context.platformUserId, context.clinicId],
      },
      {
        text: "select graftvision_private.set_tenant_context($1::uuid, $2::uuid)",
        values: [betaContext.platformUserId, betaContext.clinicId],
      },
    ]);
  });

  it("rolls back failures, releases the connection, and redacts database details", async () => {
    const { pool, queries, release } = createPoolFixture({
      failAt: "select private_operation()",
    });

    await expect(
      withLocalTenantContext(pool, context, async (transaction) => {
        await transaction.query("select private_operation()");
      }),
    ).rejects.toEqual(new DatabaseBoundaryError("Tenant-scoped database operation failed."));
    expect(queries.at(-1)).toEqual({ text: "rollback" });
    expect(release).toHaveBeenCalledOnce();
  });

  it("reports health without exposing connection failures", async () => {
    const healthy = createPoolFixture();
    const unavailable = createPoolFixture({ failAt: "select 1" });

    await expect(checkDatabaseHealth(healthy.pool)).resolves.toEqual({ reachable: true });
    await expect(checkDatabaseHealth(unavailable.pool)).resolves.toEqual({
      reachable: false,
    });
  });

  it("closes the pool through the server-only boundary", async () => {
    const { end, pool } = createPoolFixture();

    await expect(closeDatabasePool(pool)).resolves.toBeUndefined();
    expect(end).toHaveBeenCalledOnce();
  });

  it("rejects both invalid context identifiers", () => {
    expect(() =>
      validateTenantContext({ clinicId: context.clinicId, platformUserId: "invalid" }),
    ).toThrowError(/platformUserId/);
  });
});
