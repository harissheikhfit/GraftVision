import { describe, expect, it, vi } from "vitest";

import { hasVerifiedAuthSession, requireVerifiedAuthSession } from "./session";

import type { SupabaseClient } from "@supabase/supabase-js";

const registryMocks = vi.hoisted(() => ({
  getActiveApplicationSession: vi.fn().mockResolvedValue({
    authorityScope: "clinic",
    id: "synthetic-session",
    platformUserId: "10000000-0000-4000-8000-000000000001",
  }),
}));

vi.mock("./registry", () => registryMocks);

function clientWithClaims(claims: Record<string, unknown> | null, error: Error | null = null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: claims ? { claims } : null, error }),
    },
  } as unknown as Pick<SupabaseClient, "auth">;
}

describe("verified session", () => {
  it("accepts verified claims containing a subject", async () => {
    await expect(
      hasVerifiedAuthSession(
        clientWithClaims({ sub: "10000000-0000-4000-8000-000000000001" }),
        "clinic",
      ),
    ).resolves.toBe(true);
    await expect(
      hasVerifiedAuthSession(
        clientWithClaims({ sub: "10000000-0000-4000-8000-000000000001" }),
        "platform",
      ),
    ).resolves.toBe(false);
    await expect(
      hasVerifiedAuthSession(
        clientWithClaims({ sub: "20000000-0000-4000-8000-000000000001" }),
        "clinic",
      ),
    ).resolves.toBe(false);
  });

  it("rejects missing, invalid, and expired claims", async () => {
    await expect(hasVerifiedAuthSession(clientWithClaims(null))).resolves.toBe(false);
    await expect(
      hasVerifiedAuthSession(clientWithClaims({ sub: "synthetic-user" }, new Error("expired"))),
    ).resolves.toBe(false);
    await expect(requireVerifiedAuthSession(clientWithClaims({}))).rejects.toMatchObject({
      code: "AUTH_SESSION_REQUIRED",
    });
  });
});
