import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PLATFORM_CLINIC_ADMIN_PERMISSION = "ADMIN-PERM-007" as const;

export interface PlatformAdminContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface PlatformClinicSummary {
  readonly administrators: number;
  readonly clinicCode: string;
  readonly displayName: string;
  readonly id: string;
  readonly readinessRevision: number;
  readonly readinessState: string;
  readonly revision: number;
  readonly status: "active" | "inactive" | "suspended";
  readonly timezone: string;
}

export interface PlatformDashboard {
  readonly activeClinics: number;
  readonly clinics: readonly PlatformClinicSummary[];
  readonly inactiveClinics: number;
  readonly notReadyClinics: number;
  readonly readyClinics: number;
  readonly suspendedClinics: number;
  readonly totalClinics: number;
}

export interface PlatformOperationalUser {
  readonly authorizationVersion: number;
  readonly id: string;
  readonly platformRoles: readonly string[];
  readonly status: "active" | "archived" | "suspended";
}

export interface PlatformSessionHealthRow {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly lastActivityAt: string;
  readonly platformUserId: string;
  readonly revokedAt: string | null;
  readonly scope: "platform";
  readonly status: "active" | "expired" | "locked" | "revoked" | "stale";
}

export interface PlatformSessionHealth {
  readonly activeCount: number;
  readonly expiredCount: number;
  readonly lockedCount: number;
  readonly revokedCount: number;
  readonly sessions: readonly PlatformSessionHealthRow[];
  readonly staleCount: number;
  readonly users: readonly PlatformOperationalUser[];
}

export interface PlatformAuditRow {
  readonly action: string;
  readonly actorReference: string | null;
  readonly auditScope: string;
  readonly authorizationRevision: number | null;
  readonly clinicReference: string | null;
  readonly id: string;
  readonly occurredAt: string;
  readonly outcome: string;
  readonly reasonCode: string | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function context(input: PlatformAdminContext): void {
  if (!uuid.test(input.applicationSessionId) || !uuid.test(input.providerIdentityId)) {
    throw new DatabaseBoundaryError("Platform administration context is invalid.");
  }
}

export async function readPlatformDashboard(
  transaction: TenantTransaction,
  input: PlatformAdminContext,
): Promise<PlatformDashboard> {
  context(input);
  const result = await transaction.query<{ readonly dashboard: PlatformDashboard }>(
    "select graftvision_private.read_platform_dashboard($1::uuid,$2::uuid) as dashboard",
    [input.applicationSessionId, input.providerIdentityId],
  );
  if (!result.rows[0]?.dashboard)
    throw new DatabaseBoundaryError("Platform dashboard unavailable.");
  return result.rows[0].dashboard;
}

export async function updatePlatformClinicMetadata(
  transaction: TenantTransaction,
  input: PlatformAdminContext & {
    readonly clinicId: string;
    readonly displayName: string;
    readonly expectedRevision: number;
    readonly timezone: string;
  },
): Promise<number> {
  context(input);
  if (!uuid.test(input.clinicId)) throw new DatabaseBoundaryError("Clinic is invalid.");
  const result = await transaction.query<{ readonly revision: number }>(
    `select graftvision_private.update_platform_clinic_metadata(
      $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::integer
    ) as revision`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.clinicId,
      input.displayName,
      input.timezone,
      input.expectedRevision,
    ],
  );
  if (!result.rows[0]?.revision) throw new DatabaseBoundaryError("Clinic update failed.");
  return result.rows[0].revision;
}

export async function managePlatformClinicAdministrator(
  transaction: TenantTransaction,
  input: PlatformAdminContext & {
    readonly clinicId: string;
    readonly operation: "assign" | "remove" | "replace";
    readonly targetPlatformUserId: string;
  },
): Promise<string> {
  context(input);
  if (!uuid.test(input.clinicId) || !uuid.test(input.targetPlatformUserId)) {
    throw new DatabaseBoundaryError("Clinic administrator target is invalid.");
  }
  const result = await transaction.query<{ readonly membership_id: string }>(
    `select graftvision_private.manage_platform_clinic_administrator(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text
    ) as membership_id`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.clinicId,
      input.targetPlatformUserId,
      input.operation,
    ],
  );
  if (!result.rows[0]?.membership_id) {
    throw new DatabaseBoundaryError("Clinic administrator operation failed.");
  }
  return result.rows[0].membership_id;
}

export async function managePlatformUserLifecycle(
  transaction: TenantTransaction,
  input: PlatformAdminContext & {
    readonly expectedAuthorizationVersion: number;
    readonly operation: "deactivate" | "reactivate";
    readonly reasonCode: string;
    readonly targetPlatformUserId: string;
  },
): Promise<number> {
  context(input);
  if (!uuid.test(input.targetPlatformUserId))
    throw new DatabaseBoundaryError("Platform user is invalid.");
  const result = await transaction.query<{ readonly revision: number }>(
    `select graftvision_private.manage_platform_user_lifecycle(
      $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::integer
    ) as revision`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.targetPlatformUserId,
      input.operation,
      input.reasonCode,
      input.expectedAuthorizationVersion,
    ],
  );
  if (!result.rows[0]?.revision) throw new DatabaseBoundaryError("User lifecycle update failed.");
  return result.rows[0].revision;
}

export async function revokePlatformUserSessions(
  transaction: TenantTransaction,
  input: PlatformAdminContext & {
    readonly reasonCode: string;
    readonly revokeAll: boolean;
    readonly targetPlatformUserId: string;
    readonly targetSessionId?: string;
  },
): Promise<number> {
  context(input);
  if (
    !uuid.test(input.targetPlatformUserId) ||
    (input.targetSessionId !== undefined && !uuid.test(input.targetSessionId))
  )
    throw new DatabaseBoundaryError("Platform session target is invalid.");
  const result = await transaction.query<{ readonly affected: number }>(
    `select graftvision_private.revoke_platform_user_sessions(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::boolean,$6::text
    ) as affected`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.targetPlatformUserId,
      input.targetSessionId ?? null,
      input.revokeAll,
      input.reasonCode,
    ],
  );
  return result.rows[0]?.affected ?? 0;
}

export async function readPlatformSessionHealth(
  transaction: TenantTransaction,
  input: PlatformAdminContext,
): Promise<PlatformSessionHealth> {
  context(input);
  const result = await transaction.query<{ readonly health: PlatformSessionHealth }>(
    `select graftvision_private.read_platform_session_health(
      $1::uuid,$2::uuid,null,null,25
    ) as health`,
    [input.applicationSessionId, input.providerIdentityId],
  );
  if (!result.rows[0]?.health)
    throw new DatabaseBoundaryError("Platform session health unavailable.");
  return result.rows[0].health;
}

export async function readPlatformAudit(
  transaction: TenantTransaction,
  input: PlatformAdminContext,
): Promise<readonly PlatformAuditRow[]> {
  context(input);
  const result = await transaction.query<{
    readonly action: string;
    readonly actor_reference: string | null;
    readonly audit_scope: string;
    readonly authorization_revision: number | null;
    readonly clinic_reference: string | null;
    readonly id: string;
    readonly occurred_at: Date;
    readonly outcome: string;
    readonly reason_code: string | null;
  }>(
    `select * from graftvision_private.read_filtered_platform_audit(
      $1::uuid,$2::uuid,null,null,null,null,null,null,25
    )`,
    [input.applicationSessionId, input.providerIdentityId],
  );
  return result.rows.map((row) => ({
    action: row.action,
    actorReference: row.actor_reference,
    auditScope: row.audit_scope,
    authorizationRevision: row.authorization_revision,
    clinicReference: row.clinic_reference,
    id: row.id,
    occurredAt: row.occurred_at.toISOString(),
    outcome: row.outcome,
    reasonCode: row.reason_code,
  }));
}
