import { describe, expect, it, vi } from "vitest";

import { createSupabaseMfaCapabilityProvider } from "./mfa";

import type { SupabaseClient } from "@supabase/supabase-js";

function authClient(result: unknown) {
  return {
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue(result),
      },
    },
  } as unknown as Pick<SupabaseClient, "auth">;
}

describe("MFA readiness provider", () => {
  it("reports verified TOTP capability without enforcing enrolment", async () => {
    const provider = createSupabaseMfaCapabilityProvider(
      authClient({
        data: {
          phone: [],
          totp: [{ status: "verified" }, { status: "unverified" }],
        },
        error: null,
      }),
    );

    await expect(provider.getStatus()).resolves.toEqual({
      state: "ready",
      totpFactorCount: 1,
    });
  });

  it("fails closed without exposing provider errors", async () => {
    const provider = createSupabaseMfaCapabilityProvider(
      authClient({ data: null, error: new Error("provider unavailable") }),
    );

    await expect(provider.getStatus()).resolves.toEqual({ state: "unavailable" });
  });
});
