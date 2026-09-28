import "server-only";

import {
  createDatabasePool,
  resolveAuthIdentity,
  resolveLoginIdentity,
} from "@graftvision/database";

import { AuthBoundaryError } from "../shared/errors";

import type {
  AuthenticatedUser,
  LoginAuthority,
  LoginIdentity,
  VerifiedProviderIdentity,
} from "../shared/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface IdentityResolver {
  (identity: VerifiedProviderIdentity): Promise<
    | {
        readonly access: "active";
        readonly clinicId: string;
        readonly platformUserId: string;
      }
    | {
        readonly access:
          "clinic-access-unavailable" | "identity-not-linked" | "internal-user-inactive";
      }
  >;
}

export interface LoginIdentityResolver {
  (identity: VerifiedProviderIdentity): Promise<
    | {
        readonly access: "active";
        readonly clinicId: string | null;
        readonly hasPlatformOwnerAuthority: boolean;
        readonly platformUserId: string;
      }
    | {
        readonly access:
          "application-scope-unavailable" | "identity-not-linked" | "internal-user-inactive";
      }
  >;
}

async function verifiedProviderIdentity(
  authClient: Pick<SupabaseClient, "auth">,
): Promise<VerifiedProviderIdentity> {
  const { data, error } = await authClient.auth.getUser();
  const authUser = data.user;

  if (error || !authUser) {
    throw new AuthBoundaryError("AUTH_SESSION_REQUIRED");
  }

  if (!authUser.email || !uuidPattern.test(authUser.id)) {
    throw new AuthBoundaryError("AUTH_IDENTITY_NOT_LINKED");
  }

  return { email: authUser.email, id: authUser.id };
}

export async function resolveCurrentUser(
  authClient: Pick<SupabaseClient, "auth">,
  resolveIdentity: IdentityResolver,
): Promise<AuthenticatedUser> {
  const resolution = await resolveIdentity(await verifiedProviderIdentity(authClient));

  if (resolution.access !== "active") {
    const code = {
      "clinic-access-unavailable": "AUTH_CLINIC_ACCESS_UNAVAILABLE",
      "identity-not-linked": "AUTH_IDENTITY_NOT_LINKED",
      "internal-user-inactive": "AUTH_INTERNAL_USER_INACTIVE",
    } as const;

    throw new AuthBoundaryError(code[resolution.access]);
  }

  return {
    clinicId: resolution.clinicId,
    displayLabel: "Authenticated user",
    platformUserId: resolution.platformUserId,
    status: "active",
  };
}

export async function resolveLoginUser(
  authClient: Pick<SupabaseClient, "auth">,
  resolveIdentity: LoginIdentityResolver,
): Promise<LoginIdentity> {
  const resolution = await resolveIdentity(await verifiedProviderIdentity(authClient));

  if (resolution.access !== "active") {
    const code = {
      "application-scope-unavailable": "AUTH_APPLICATION_SCOPE_UNAVAILABLE",
      "identity-not-linked": "AUTH_IDENTITY_NOT_LINKED",
      "internal-user-inactive": "AUTH_INTERNAL_USER_INACTIVE",
    } as const;
    throw new AuthBoundaryError(code[resolution.access]);
  }

  return {
    clinicId: resolution.clinicId,
    displayLabel: "Authenticated user",
    hasPlatformOwnerAuthority: resolution.hasPlatformOwnerAuthority,
    platformUserId: resolution.platformUserId,
    status: "active",
  };
}

export function selectLoginAuthority(identity: LoginIdentity): LoginAuthority {
  if (identity.hasPlatformOwnerAuthority) {
    return { authorityScope: "platform", destination: "/platform" };
  }
  if (identity.clinicId) {
    return {
      authorityScope: "clinic",
      clinicId: identity.clinicId,
      destination: "/clinic",
    };
  }
  throw new AuthBoundaryError("AUTH_APPLICATION_SCOPE_UNAVAILABLE");
}

export async function getLoginUser(
  authClient: Pick<SupabaseClient, "auth">,
): Promise<LoginIdentity> {
  const pool = createDatabasePool();
  try {
    return await resolveLoginUser(authClient, async (identity) =>
      resolveLoginIdentity(pool, identity.id, identity.email),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function getCurrentUser(
  authClient: Pick<SupabaseClient, "auth">,
): Promise<AuthenticatedUser> {
  const pool = createDatabasePool();

  try {
    return await resolveCurrentUser(authClient, async (identity) =>
      resolveAuthIdentity(pool, identity.id, identity.email),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}
