import { beforeEach, describe, expect, it, vi } from "vitest";

import { reauthenticateAndUnlock } from "./reauthentication";

import type { SupabaseClient } from "@supabase/supabase-js";

const registry = vi.hoisted(() => ({
  getCurrentApplicationSessionState: vi.fn(),
  recordCurrentSessionReauthenticationFailed: vi.fn(),
  terminateLockedSession: vi.fn(),
  unlockCurrentApplicationSession: vi.fn(),
}));

vi.mock("./registry", () => registry);

const providerId = "e1000000-0000-4000-8000-000000000001";
const lockedSession = {
  authorityScope: "clinic" as const,
  clinicId: "e2000000-0000-4000-8000-000000000001",
  id: "e5000000-0000-4000-8000-000000000001",
  platformUserId: providerId,
};

function client(passwordResult: unknown) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { email: "doctor@example.test", id: providerId } },
    error: null,
  });
  const signInWithPassword = vi.fn().mockResolvedValue(passwordResult);
  const signOut = vi.fn().mockResolvedValue({ error: null });
  return {
    authClient: {
      auth: {
        getUser,
        signInWithPassword,
        signOut,
      },
    } as unknown as Pick<SupabaseClient, "auth">,
    getUser,
    signInWithPassword,
    signOut,
  };
}

describe("reauthenticateAndUnlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.recordCurrentSessionReauthenticationFailed.mockResolvedValue(undefined);
    registry.terminateLockedSession.mockResolvedValue(undefined);
    registry.getCurrentApplicationSessionState.mockResolvedValue({
      session: lockedSession,
      status: "locked",
    });
  });

  it("unlocks only after matching password reauthentication", async () => {
    const unlocked = { ...lockedSession, lockedAt: null };
    registry.unlockCurrentApplicationSession.mockResolvedValue(unlocked);

    const { authClient } = client({ data: { user: { id: providerId } }, error: null });
    await expect(reauthenticateAndUnlock(authClient, "valid-password")).resolves.toEqual(unlocked);
    expect(registry.recordCurrentSessionReauthenticationFailed).not.toHaveBeenCalled();
    expect(registry.terminateLockedSession).not.toHaveBeenCalled();
  });

  it("audits failure and logs out the locked session", async () => {
    const { authClient, signOut } = client({
      data: { user: null },
      error: new Error("invalid credentials"),
    });

    await expect(reauthenticateAndUnlock(authClient, "wrong-password")).rejects.toMatchObject({
      code: "AUTH_REAUTHENTICATION_FAILED",
    });
    expect(registry.recordCurrentSessionReauthenticationFailed).toHaveBeenCalledWith(providerId);
    expect(registry.terminateLockedSession).toHaveBeenCalledWith(providerId);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not reauthenticate a mismatched or unlocked session", async () => {
    registry.getCurrentApplicationSessionState.mockResolvedValue(null);
    const { authClient, signInWithPassword } = client({
      data: { user: { id: providerId } },
      error: null,
    });

    await expect(reauthenticateAndUnlock(authClient, "password")).rejects.toMatchObject({
      code: "AUTH_SESSION_REQUIRED",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("logs out when provider reauthentication is unavailable", async () => {
    const { authClient, getUser, signOut } = client({
      data: { user: { id: providerId } },
      error: null,
    });
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("provider unavailable"),
    });

    await expect(reauthenticateAndUnlock(authClient, "password")).rejects.toMatchObject({
      code: "AUTH_REAUTHENTICATION_FAILED",
    });
    expect(registry.recordCurrentSessionReauthenticationFailed).toHaveBeenCalledWith(providerId);
    expect(registry.terminateLockedSession).toHaveBeenCalledWith(providerId);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
