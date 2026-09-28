import "server-only";

import { AuthBoundaryError } from "../shared/errors";

import { terminateCurrentSession } from "./registry";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function signOutSafely(authClient: Pick<SupabaseClient, "auth">): Promise<void> {
  const { error } = await authClient.auth.signOut({ scope: "local" });
  await terminateCurrentSession();

  if (error) {
    throw new AuthBoundaryError("AUTH_LOGOUT_FAILED");
  }
}
