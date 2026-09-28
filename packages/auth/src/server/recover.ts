import "server-only";

import { AuthBoundaryError } from "../shared/errors";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function sendPasswordRecoveryEmail(
  client: Pick<SupabaseClient, "auth">,
  email: string,
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email);

  if (error) {
    throw new AuthBoundaryError("AUTH_RECOVERY_FAILED");
  }
}
