import { beforeEach, describe, expect, it, vi } from "vitest";

import { logoutAfterLockAction, unlockAction } from "./actions";

const fixtures = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  getCurrentApplicationSessionState: vi.fn(),
  reauthenticateAndUnlock: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  terminateLockedSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: fixtures.redirect }));
vi.mock("@graftvision/auth/server", () => ({
  createRequestAuthClient: fixtures.createRequestAuthClient,
  getCurrentApplicationSessionState: fixtures.getCurrentApplicationSessionState,
  reauthenticateAndUnlock: fixtures.reauthenticateAndUnlock,
  terminateLockedSession: fixtures.terminateLockedSession,
}));

const providerIdentityId = "e1000000-0000-4000-8000-000000000001";
const signOut = vi.fn();

function passwordForm(password: string): FormData {
  const form = new FormData();
  form.set("password", password);
  return form;
}

describe("locked-session Server Actions", () => {
  beforeEach(() => {
    fixtures.createRequestAuthClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: providerIdentityId } },
          error: null,
        }),
        signOut,
      },
    });
    signOut.mockResolvedValue({ error: null });
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: {
        authorityScope: "clinic",
        platformUserId: providerIdentityId,
      },
      status: "locked",
    });
    fixtures.reauthenticateAndUnlock.mockResolvedValue({ authorityScope: "clinic" });
    fixtures.terminateLockedSession.mockResolvedValue(undefined);
  });

  it.each([
    ["clinic", "/clinic"],
    ["platform", "/platform"],
  ] as const)("returns only to the revalidated %s authority shell", async (scope, destination) => {
    fixtures.reauthenticateAndUnlock.mockResolvedValue({ authorityScope: scope });

    await expect(unlockAction(passwordForm("synthetic-password"))).rejects.toThrow(
      `REDIRECT:${destination}`,
    );
    expect(fixtures.reauthenticateAndUnlock).toHaveBeenCalledWith(
      expect.anything(),
      "synthetic-password",
    );
  });

  it.each(["", "x".repeat(1025)])(
    "denies invalid password input without calling the reauthentication boundary",
    async (password) => {
      await expect(unlockAction(passwordForm(password))).rejects.toThrow("REDIRECT:/login");
      expect(fixtures.reauthenticateAndUnlock).not.toHaveBeenCalled();
    },
  );

  it("uses the generic public redirect when reauthentication fails", async () => {
    fixtures.reauthenticateAndUnlock.mockRejectedValue(new Error("provider detail"));

    await expect(unlockAction(passwordForm("wrong-password"))).rejects.toThrow("REDIRECT:/login");
  });

  it("terminates only a matching locked session before provider logout", async () => {
    await expect(logoutAfterLockAction()).rejects.toThrow("REDIRECT:/login");
    expect(fixtures.terminateLockedSession).toHaveBeenCalledWith(providerIdentityId);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not terminate a forged or unlocked application context", async () => {
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: {
        authorityScope: "clinic",
        platformUserId: "e1000000-0000-4000-8000-000000000099",
      },
      status: "locked",
    });

    await expect(logoutAfterLockAction()).rejects.toThrow("REDIRECT:/login");
    expect(fixtures.terminateLockedSession).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
