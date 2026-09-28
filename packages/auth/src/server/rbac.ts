import "server-only";

import type { TenantTransaction } from "@graftvision/database";

import { AuthBoundaryError } from "../shared/errors";

export type RoleCode =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "PLATFORM_SUPPORT"
  | "CLINIC_OWNER"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "CLINICAL_ASSISTANT"
  | "PROCEDURE_TECHNICIAN"
  | "RECEPTION"
  | "REPORT_COORDINATOR"
  | "PRESENTATION"
  | "REVIEWER"
  | "PATIENT";

export type PermissionId = string; // Canonical permission identifiers are database-authoritative.

export type PermissionEvaluationContext =
  | {
      readonly applicationSessionId: string;
      readonly authorityScope: "clinic";
      readonly clinicId: string;
      readonly providerIdentityId: string;
    }
  | {
      readonly applicationSessionId: string;
      readonly authorityScope: "platform";
      readonly clinicId?: never;
      readonly providerIdentityId: string;
    };

export async function evaluatePermission(
  pool: TenantTransaction,
  context: PermissionEvaluationContext,
  permissionId: PermissionId,
): Promise<boolean> {
  try {
    const result = await pool.query<{ readonly has_permission: boolean }>(
      `select graftvision_private.has_application_session_permission(
        $1::uuid, $2::uuid, $3::text, $4::uuid, $5::text
      ) as has_permission`,
      [
        context.applicationSessionId,
        context.providerIdentityId,
        context.authorityScope,
        context.authorityScope === "clinic" ? context.clinicId : null,
        permissionId,
      ],
    );

    return result.rows[0]?.has_permission ?? false;
  } catch (_error) {
    throw new AuthBoundaryError("AUTH_SESSION_REQUIRED"); // Generic failure
  }
}

export async function requirePermission(
  pool: TenantTransaction,
  context: PermissionEvaluationContext,
  permissionId: PermissionId,
): Promise<void> {
  const allowed = await evaluatePermission(pool, context, permissionId);
  if (!allowed) {
    throw new AuthBoundaryError("AUTH_PERMISSION_DENIED");
  }
}
