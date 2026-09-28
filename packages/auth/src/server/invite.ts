import "server-only";

import { AuthBoundaryError } from "../shared/errors";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function inviteUserByEmail(
  adminClient: Pick<SupabaseClient, "auth">,
  email: string,
  metadata?: object,
): Promise<void> {
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    ...(metadata ? { data: metadata } : {}),
  });

  if (error) {
    throw new AuthBoundaryError("AUTH_INVITATION_FAILED");
  }
}
