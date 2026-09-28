import "server-only";

import { AuthBoundaryError } from "../shared/errors";

import { getActiveApplicationSession } from "./registry";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasVerifiedAuthSession(
  authClient: Pick<SupabaseClient, "auth">,
  requiredAuthorityScope?: "clinic" | "platform",
): Promise<boolean> {
  const { data, error } = await authClient.auth.getClaims();
  if (error || !data?.claims.sub) {
    return false;
  }

  const appSession = await getActiveApplicationSession();
  return (
    appSession !== null &&
    appSession.platformUserId === data.claims.sub &&
    (requiredAuthorityScope === undefined || appSession.authorityScope === requiredAuthorityScope)
  );
}

export async function requireVerifiedAuthSession(
  authClient: Pick<SupabaseClient, "auth">,
  requiredAuthorityScope?: "clinic" | "platform",
): Promise<void> {
  if (!(await hasVerifiedAuthSession(authClient, requiredAuthorityScope))) {
    throw new AuthBoundaryError("AUTH_SESSION_REQUIRED");
  }
}
