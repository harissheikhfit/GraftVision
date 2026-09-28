import "server-only";

import type { ApplicationSession } from "@graftvision/database";

import { AuthBoundaryError } from "../shared/errors";

import {
  getCurrentApplicationSessionState,
  recordCurrentSessionReauthenticationFailed,
  terminateLockedSession,
  unlockCurrentApplicationSession,
} from "./registry";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function reauthenticateAndUnlock(
  authClient: Pick<SupabaseClient, "auth">,
  password: string,
): Promise<ApplicationSession> {
  const state = await getCurrentApplicationSessionState();
  const { data } = await authClient.auth.getUser();
  const providerUser = data.user;

  if (state?.status !== "locked") {
    throw new AuthBoundaryError("AUTH_SESSION_REQUIRED");
  }

  if (!providerUser?.email || state.session.platformUserId !== providerUser.id) {
    await recordCurrentSessionReauthenticationFailed(state.session.platformUserId).catch(
      () => undefined,
    );
    await terminateLockedSession(state.session.platformUserId).catch(() => undefined);
    await authClient.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new AuthBoundaryError("AUTH_REAUTHENTICATION_FAILED");
  }

  const reauthentication = await authClient.auth.signInWithPassword({
    email: providerUser.email,
    password,
  });

  if (reauthentication.error || reauthentication.data.user?.id !== providerUser.id) {
    await recordCurrentSessionReauthenticationFailed(providerUser.id).catch(() => undefined);
    await terminateLockedSession(providerUser.id).catch(() => undefined);
    await authClient.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new AuthBoundaryError("AUTH_REAUTHENTICATION_FAILED");
  }

  const unlocked = await unlockCurrentApplicationSession(providerUser.id);
  if (!unlocked) {
    await terminateLockedSession(providerUser.id).catch(() => undefined);
    await authClient.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new AuthBoundaryError("AUTH_REAUTHENTICATION_FAILED");
  }

  return unlocked;
}
