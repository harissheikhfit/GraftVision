import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

import type { Pool } from "pg";

interface SessionRow {
  readonly absolute_expires_at: Date;
  readonly authority_scope: AuthorityScope;
  readonly clinic_authorization_version: number | null;
  readonly clinic_id: string | null;
  readonly created_at: Date;
  readonly device_label: string;
  readonly id: string;
  readonly last_activity_at: Date;
  readonly locked_at: Date | null;
  readonly lock_reason_code: SessionLockReason | null;
  readonly platform_authorization_version: number;
  readonly platform_user_id: string;
  readonly provider_session_id: string | null;
  readonly revoke_reason_code: string | null;
  readonly revoked_at: Date | null;
  readonly reauthenticated_at: Date | null;
  readonly updated_at: Date;
  readonly user_agent_hash: string | null;
}

async function writeSessionAuditEvent(
  transaction: TenantTransaction,
  input: {
    readonly action: string;
    readonly reasonCode?: string;
    readonly resourceId: string;
  },
): Promise<void> {
  await transaction.query(
    `select graftvision_private.write_platform_system_audit_event(
      $1::text,
      'application_session',
      $2::uuid,
      'success',
      $3::text,
      null,
      'database',
      '{}'::jsonb
    )`,
    [input.action, input.resourceId, input.reasonCode ?? null],
  );
}

export interface ApplicationSession {
  readonly id: string;
  readonly authorityScope: AuthorityScope;
  readonly platformUserId: string;
  readonly clinicId: string | null;
  readonly providerSessionId: string | null;
  readonly platformAuthorizationVersion: number;
  readonly clinicAuthorizationVersion: number | null;
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly lockedAt: Date | null;
  readonly lockReasonCode: SessionLockReason | null;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly reauthenticatedAt: Date | null;
  readonly revokeReasonCode: string | null;
  readonly deviceLabel: string;
  readonly userAgentHash: string | null;
  readonly updatedAt: Date;
}

export type AuthorityScope = "clinic" | "platform";
export type SessionLockReason = "IDLE" | "MANUAL";

interface CreateSessionParamsBase {
  readonly platformUserId: string;
  readonly providerSessionId?: string;
  readonly absoluteExpiresAt: Date;
  readonly deviceLabel: string;
  readonly userAgentHash?: string;
}

export type CreateSessionParams = CreateSessionParamsBase &
  (
    | { readonly authorityScope: "clinic"; readonly clinicId: string }
    | { readonly authorityScope: "platform"; readonly clinicId?: never }
  );

function mapSessionRow(row: SessionRow): ApplicationSession {
  return {
    id: row.id,
    authorityScope: row.authority_scope,
    platformUserId: row.platform_user_id,
    clinicId: row.clinic_id,
    providerSessionId: row.provider_session_id,
    platformAuthorizationVersion: row.platform_authorization_version,
    clinicAuthorizationVersion: row.clinic_authorization_version,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    lockedAt: row.locked_at,
    lockReasonCode: row.lock_reason_code,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    reauthenticatedAt: row.reauthenticated_at,
    revokeReasonCode: row.revoke_reason_code,
    deviceLabel: row.device_label,
    userAgentHash: row.user_agent_hash,
    updatedAt: row.updated_at,
  };
}

export async function createApplicationSession(
  pool: Pool,
  params: CreateSessionParams,
): Promise<ApplicationSession> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const result = await client.query<{ readonly id: string }>(
      `
      select graftvision_private.create_application_session(
        $1, $2, $3, $4, $5, $6, $7
      ) as id
    `,
      [
        params.platformUserId,
        params.authorityScope,
        params.authorityScope === "clinic" ? params.clinicId : null,
        params.providerSessionId || null,
        params.absoluteExpiresAt,
        params.deviceLabel,
        params.userAgentHash || null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new DatabaseBoundaryError("Created application session ID was not returned.");
    }

    // We need to fetch the created session back to return it, since the function just returns the ID
    const sessionResult = await client.query<SessionRow>(
      `
      select
        id, authority_scope, platform_user_id, clinic_id, provider_session_id,
        platform_authorization_version, clinic_authorization_version,
        created_at, last_activity_at, locked_at, lock_reason_code, reauthenticated_at,
        absolute_expires_at, revoked_at, revoke_reason_code, device_label, user_agent_hash, updated_at
      from public.application_session
      where id = $1
      `,
      [row.id],
    );

    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) {
      throw new DatabaseBoundaryError("Created application session was not found.");
    }

    await writeSessionAuditEvent(client, {
      action: "session.create",
      resourceId: row.id,
    });

    await client.query("commit");

    return mapSessionRow(sessionRow);
  } catch {
    await client.query("rollback");
    throw new DatabaseBoundaryError("Failed to create application session.");
  } finally {
    client.release();
  }
}

export async function getApplicationSession(
  pool: Pool,
  sessionId: string,
): Promise<ApplicationSession | null> {
  try {
    const validResult = await pool.query<{ readonly is_valid: boolean }>(
      `select graftvision_private.validate_application_session($1) as is_valid`,
      [sessionId],
    );

    if (!validResult.rows[0]?.is_valid) {
      return null;
    }

    const result = await pool.query<SessionRow>(
      `
      select
        id, authority_scope, platform_user_id, clinic_id, provider_session_id,
        platform_authorization_version, clinic_authorization_version,
        created_at, last_activity_at, locked_at, lock_reason_code, reauthenticated_at,
        absolute_expires_at, revoked_at, revoke_reason_code, device_label, user_agent_hash, updated_at
      from public.application_session
      where id = $1
    `,
      [sessionId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapSessionRow(row);
  } catch {
    throw new DatabaseBoundaryError("Failed to get application session.");
  }
}

export async function getApplicationSessionState(
  pool: Pool,
  sessionId: string,
): Promise<ApplicationSession | null> {
  try {
    const result = await pool.query<SessionRow>(
      `select
        id, authority_scope, platform_user_id, clinic_id, provider_session_id,
        platform_authorization_version, clinic_authorization_version,
        created_at, last_activity_at, locked_at, lock_reason_code, reauthenticated_at,
        absolute_expires_at, revoked_at, revoke_reason_code, device_label, user_agent_hash, updated_at
      from public.application_session
      where id = $1::uuid`,
      [sessionId],
    );
    const row = result.rows[0];
    return row ? mapSessionRow(row) : null;
  } catch {
    throw new DatabaseBoundaryError("Failed to get application session state.");
  }
}

export type RotateSessionAuthorityParams = Omit<
  CreateSessionParams,
  "platformUserId" | "providerSessionId"
> & {
  readonly currentSessionId: string;
  readonly providerIdentityId: string;
};

export async function rotateApplicationSessionAuthority(
  pool: Pool,
  params: RotateSessionAuthorityParams,
): Promise<ApplicationSession> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ readonly id: string }>(
      `select graftvision_private.rotate_application_session_authority(
        $1::uuid, $2::uuid, $3::text, $4::uuid, $5::timestamptz, $6::text, $7::text
      ) as id`,
      [
        params.currentSessionId,
        params.providerIdentityId,
        params.authorityScope,
        params.authorityScope === "clinic" ? params.clinicId : null,
        params.absoluteExpiresAt,
        params.deviceLabel,
        params.userAgentHash ?? null,
      ],
    );
    const sessionId = result.rows[0]?.id;
    if (!sessionId) {
      throw new DatabaseBoundaryError("Rotated application session ID was not returned.");
    }

    const sessionResult = await client.query<SessionRow>(
      `select
        id, authority_scope, platform_user_id, clinic_id, provider_session_id,
        platform_authorization_version, clinic_authorization_version,
        created_at, last_activity_at, locked_at, lock_reason_code, reauthenticated_at,
        absolute_expires_at, revoked_at, revoke_reason_code, device_label, user_agent_hash, updated_at
      from public.application_session
      where id = $1::uuid`,
      [sessionId],
    );
    const row = sessionResult.rows[0];
    if (!row) {
      throw new DatabaseBoundaryError("Rotated application session was not found.");
    }

    await client.query("commit");
    return mapSessionRow(row);
  } catch {
    await client.query("rollback");
    throw new DatabaseBoundaryError("Failed to rotate application session authority.");
  } finally {
    client.release();
  }
}

export async function lockApplicationSession(
  pool: Pool,
  input: {
    readonly providerIdentityId: string;
    readonly reasonCode: SessionLockReason;
    readonly sessionId: string;
  },
): Promise<boolean> {
  const result = await pool.query<{ readonly locked: boolean }>(
    `select graftvision_private.lock_application_session($1::uuid, $2::uuid, $3::text) as locked`,
    [input.sessionId, input.providerIdentityId, input.reasonCode],
  );
  return result.rows[0]?.locked ?? false;
}

export async function unlockApplicationSession(
  pool: Pool,
  input: {
    readonly clinicId: string | null;
    readonly expectedScope: AuthorityScope;
    readonly providerIdentityId: string;
    readonly sessionId: string;
  },
): Promise<boolean> {
  const result = await pool.query<{ readonly unlocked: boolean }>(
    `select graftvision_private.unlock_application_session(
      $1::uuid, $2::uuid, $3::text, $4::uuid
    ) as unlocked`,
    [input.sessionId, input.providerIdentityId, input.expectedScope, input.clinicId],
  );
  return result.rows[0]?.unlocked ?? false;
}

export async function recordSessionReauthenticationFailed(
  pool: Pool,
  sessionId: string,
  providerIdentityId: string,
): Promise<void> {
  await pool.query(
    `select graftvision_private.record_session_reauthentication_failed($1::uuid, $2::uuid)`,
    [sessionId, providerIdentityId],
  );
}

export async function logoutLockedApplicationSession(
  pool: Pool,
  sessionId: string,
  providerIdentityId: string,
): Promise<void> {
  await pool.query(
    `select graftvision_private.logout_locked_application_session($1::uuid, $2::uuid)`,
    [sessionId, providerIdentityId],
  );
}

export async function recordApplicationSessionActivity(
  pool: Pool,
  sessionId: string,
  providerIdentityId: string,
): Promise<boolean> {
  const result = await pool.query<{ readonly recorded: boolean }>(
    `select graftvision_private.record_application_session_activity(
      $1::uuid, $2::uuid
    ) as recorded`,
    [sessionId, providerIdentityId],
  );
  return result.rows[0]?.recorded ?? false;
}

export async function revokeApplicationSession(
  pool: Pool,
  sessionId: string,
  reasonCode: "LOGOUT" | "REVOKE_ONE" | "DEACTIVATED",
  actorId?: string,
): Promise<void> {
  void actorId;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ readonly id: string }>(
      `
      update public.application_session
      set revoked_at = timezone('utc', statement_timestamp()),
          revoke_reason_code = $2,
          updated_at = timezone('utc', statement_timestamp())
      where id = $1 and revoked_at is null
      returning id, platform_user_id, clinic_id
    `,
      [sessionId, reasonCode],
    );

    if (result.rows.length > 0) {
      const action =
        reasonCode === "LOGOUT"
          ? "session.end"
          : reasonCode === "DEACTIVATED"
            ? "session.deny_inactive_user"
            : "session.revoke_other";

      await writeSessionAuditEvent(client, {
        action,
        resourceId: sessionId,
        reasonCode,
      });
    }

    await client.query("commit");
  } catch {
    await client.query("rollback");
    throw new DatabaseBoundaryError("Failed to revoke application session.");
  } finally {
    client.release();
  }
}

export async function revokeAllOtherApplicationSessions(
  pool: Pool,
  platformUserId: string,
  keepSessionId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ readonly id: string }>(
      `
      update public.application_session
      set revoked_at = timezone('utc', statement_timestamp()),
          revoke_reason_code = 'REVOKE_ALL',
          updated_at = timezone('utc', statement_timestamp())
      where platform_user_id = $1 and id != $2 and revoked_at is null
      returning id, clinic_id
    `,
      [platformUserId, keepSessionId],
    );

    for (const row of result.rows) {
      await writeSessionAuditEvent(client, {
        action: "session.revoke_others",
        resourceId: row.id,
        reasonCode: "REVOKE_ALL",
      });
    }

    await client.query("commit");
  } catch {
    await client.query("rollback");
    throw new DatabaseBoundaryError("Failed to revoke other application sessions.");
  } finally {
    client.release();
  }
}
