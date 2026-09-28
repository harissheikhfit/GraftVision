import "server-only";

import type { Pool } from "pg";

export type AuthIdentityResolution =
  | {
      readonly access: "active";
      readonly clinicId: string;
      readonly platformUserId: string;
    }
  | {
      readonly access:
        "clinic-access-unavailable" | "identity-not-linked" | "internal-user-inactive";
    };

export type LoginIdentityResolution =
  | {
      readonly access: "active";
      readonly clinicId: string | null;
      readonly hasPlatformOwnerAuthority: boolean;
      readonly platformUserId: string;
    }
  | {
      readonly access:
        "application-scope-unavailable" | "identity-not-linked" | "internal-user-inactive";
    };

interface IdentityRow {
  readonly active_membership_count: number;
  readonly default_clinic_id: string | null;
  readonly id: string;
  readonly status: string;
}

interface LoginIdentityRow extends IdentityRow {
  readonly has_platform_owner_authority: boolean;
}

async function recordLoginScopeDenial(
  pool: Pool,
  platformUserId: string,
  reasonCode: "LOGIN_INACTIVE_USER" | "LOGIN_SCOPE_UNAVAILABLE",
): Promise<void> {
  await pool.query(
    `select graftvision_private.write_platform_system_audit_event(
      'session.create',
      'platform_user',
      $1::uuid,
      'denied',
      $2::text,
      null,
      'database',
      '{}'::jsonb
    )`,
    [platformUserId, reasonCode],
  );
}

export async function resolveLoginIdentity(
  pool: Pool,
  authUserId: string,
  verifiedEmail: string,
): Promise<LoginIdentityResolution> {
  try {
    const result = await pool.query<LoginIdentityRow>(
      `select
         platform_user.id::text,
         platform_user.status,
         exists (
           select 1
           from public.platform_user_role platform_role
           join public.role_definition role on role.role_code = platform_role.role_code
           where platform_role.platform_user_id = platform_user.id
             and platform_role.role_code = 'PLATFORM_OWNER'
             and role.role_type = 'platform'
         ) as has_platform_owner_authority,
         (
           select count(*)::integer
           from public.clinic_membership membership
           join public.clinic clinic on clinic.id = membership.clinic_id
           where membership.platform_user_id = platform_user.id
             and membership.membership_status = 'active'
             and clinic.status = 'active'
             and exists (
               select 1
               from public.clinic_membership_role membership_role
               join public.role_definition role on role.role_code = membership_role.role_code
               where membership_role.clinic_membership_id = membership.id
                 and role.role_type = 'clinic'
             )
         ) as active_membership_count,
         (
           select membership.clinic_id::text
           from public.clinic_membership membership
           join public.clinic clinic on clinic.id = membership.clinic_id
           where membership.platform_user_id = platform_user.id
             and membership.membership_status = 'active'
             and clinic.status = 'active'
             and exists (
               select 1
               from public.clinic_membership_role membership_role
               join public.role_definition role on role.role_code = membership_role.role_code
               where membership_role.clinic_membership_id = membership.id
                 and role.role_type = 'clinic'
             )
           order by membership.clinic_id
           limit 1
         ) as default_clinic_id
       from public.platform_user
       where platform_user.id = $1::uuid
         and lower(platform_user.external_identity_id) = lower($2)`,
      [authUserId, verifiedEmail],
    );

    if (result.rowCount !== 1 || result.rows.length !== 1) {
      return { access: "identity-not-linked" };
    }

    const identity = result.rows[0];
    if (!identity || identity.status !== "active") {
      if (identity) {
        await recordLoginScopeDenial(pool, identity.id, "LOGIN_INACTIVE_USER");
      }
      return { access: "internal-user-inactive" };
    }

    const clinicId = identity.active_membership_count > 0 ? identity.default_clinic_id : null;
    if (!identity.has_platform_owner_authority && !clinicId) {
      await recordLoginScopeDenial(pool, identity.id, "LOGIN_SCOPE_UNAVAILABLE");
      return { access: "application-scope-unavailable" };
    }

    return {
      access: "active",
      clinicId,
      hasPlatformOwnerAuthority: identity.has_platform_owner_authority,
      platformUserId: identity.id,
    };
  } catch {
    return { access: "identity-not-linked" };
  }
}

export async function resolveAuthIdentity(
  pool: Pool,
  authUserId: string,
  verifiedEmail: string,
): Promise<AuthIdentityResolution> {
  try {
    const result = await pool.query<IdentityRow>(
      `select
         platform_user.id::text,
         platform_user.status,
         (
           select count(*)::integer
           from public.clinic_membership membership
           join public.clinic clinic on clinic.id = membership.clinic_id
           where membership.platform_user_id = platform_user.id
             and membership.membership_status = 'active'
             and clinic.status = 'active'
         ) as active_membership_count,
         (
           select membership.clinic_id::text
           from public.clinic_membership membership
           join public.clinic clinic on clinic.id = membership.clinic_id
           where membership.platform_user_id = platform_user.id
             and membership.membership_status = 'active'
             and clinic.status = 'active'
           order by membership.clinic_id
           limit 1
         ) as default_clinic_id
       from public.platform_user
       where platform_user.id = $1::uuid
         and lower(platform_user.external_identity_id) = lower($2)`,
      [authUserId, verifiedEmail],
    );

    if (result.rowCount !== 1 || result.rows.length !== 1) {
      return { access: "identity-not-linked" };
    }

    const identity = result.rows[0];

    if (!identity || identity.status !== "active") {
      return { access: "internal-user-inactive" };
    }

    if (identity.active_membership_count < 1 || !identity.default_clinic_id) {
      return { access: "clinic-access-unavailable" };
    }

    return {
      access: "active",
      clinicId: identity.default_clinic_id,
      platformUserId: identity.id,
    };
  } catch {
    return { access: "identity-not-linked" };
  }
}
