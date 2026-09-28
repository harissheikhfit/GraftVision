import "server-only";

import { withLocalTenantContext } from "../server";

import { establishTenantContext } from "./tenant-context";

import type { TenantContext, TenantTransaction } from "../server";
import type { Pool } from "pg";

export async function reuseTenantTransaction<Result>(
  transaction: TenantTransaction,
  context: TenantContext,
  operation: (trustedTransaction: TenantTransaction) => Promise<Result>,
): Promise<Result> {
  await establishTenantContext(transaction, context);
  return operation(transaction);
}

export async function withTenantTransaction<Result>(
  pool: Pool,
  context: TenantContext,
  operation: (transaction: TenantTransaction) => Promise<Result>,
): Promise<Result> {
  return withLocalTenantContext(pool, context, operation);
}
