import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaReadinessStatus =
  { readonly state: "ready"; readonly totpFactorCount: number } | { readonly state: "unavailable" };

export interface MfaCapabilityProvider {
  getStatus(): Promise<MfaReadinessStatus>;
}

export function createSupabaseMfaCapabilityProvider(
  authClient: Pick<SupabaseClient, "auth">,
): MfaCapabilityProvider {
  return {
    async getStatus() {
      const { data, error } = await authClient.auth.mfa.listFactors();
      if (error) {
        return { state: "unavailable" };
      }

      return {
        state: "ready",
        totpFactorCount: data.totp.filter((factor) => factor.status === "verified").length,
      };
    },
  };
}
