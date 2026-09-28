import "server-only";

import { validateTenantContext, type TenantContext, type TenantTransaction } from "../server";

import { TenantBoundaryError } from "./tenant-errors";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface DatabaseErrorLike {
  readonly code?: unknown;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const code = (error as DatabaseErrorLike).code;
  return typeof code === "string" ? code : undefined;
}

export function validateTenantIdentifier(value: string): string {
  if (!uuidPattern.test(value)) {
    throw new TenantBoundaryError("INVALID_TENANT_IDENTIFIER");
  }

  return value;
}

export function assertTenantContext(context: TenantContext): TenantContext {
  try {
    return validateTenantContext(context);
  } catch {
    throw new TenantBoundaryError("INVALID_TENANT_IDENTIFIER");
  }
}

export async function establishTenantContext(
  transaction: TenantTransaction,
  context: TenantContext,
): Promise<void> {
  const trustedContext = assertTenantContext(context);

  try {
    await transaction.query("select graftvision_private.set_tenant_context($1::uuid, $2::uuid)", [
      trustedContext.platformUserId,
      trustedContext.clinicId,
    ]);
  } catch (error) {
    const code = databaseErrorCode(error);

    if (code === "25001") {
      throw new TenantBoundaryError("TENANT_CONTEXT_SWITCH_REJECTED");
    }

    if (code === "42501") {
      throw new TenantBoundaryError("TENANT_MEMBERSHIP_REQUIRED");
    }

    throw new TenantBoundaryError("TENANT_CONTEXT_SETUP_FAILED");
  }
}

export async function assertActiveTenantContext(transaction: TenantTransaction): Promise<void> {
  try {
    await transaction.query("select graftvision_private.require_active_clinic_membership()");
  } catch {
    throw new TenantBoundaryError("TENANT_MEMBERSHIP_REQUIRED");
  }
}

export async function getTrustedTenantContext(
  transaction: TenantTransaction,
): Promise<TenantContext> {
  try {
    const result = await transaction.query<{
      readonly clinic_id: string | null;
      readonly platform_user_id: string | null;
    }>(
      `select
        graftvision_private.current_platform_user_id() as platform_user_id,
        graftvision_private.current_clinic_id() as clinic_id`,
    );
    const row = result.rows[0];

    if (!row?.clinic_id || !row.platform_user_id) {
      throw new TenantBoundaryError("TENANT_CONTEXT_MISSING");
    }

    return assertTenantContext({
      clinicId: row.clinic_id,
      platformUserId: row.platform_user_id,
    });
  } catch (error) {
    if (error instanceof TenantBoundaryError) {
      throw error;
    }

    throw new TenantBoundaryError("TENANT_CONTEXT_MISSING");
  }
}
