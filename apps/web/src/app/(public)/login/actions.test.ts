import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  establishApplicationSession: vi.fn(),
  getDeviceContext: vi.fn(),
  getLoginUser: vi.fn(),
  redirect: vi.fn(),
  selectLoginAuthority: vi.fn(),
  signOutSafely: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@graftvision/auth/server", () => ({
  AuthBoundaryError: class AuthBoundaryError extends Error {},
  authErrorMessages: {
    AUTH_APPLICATION_SCOPE_UNAVAILABLE: "No application workspace.",
    AUTH_CONFIGURATION_INVALID: "Authentication unavailable.",
    AUTH_INVALID_CREDENTIALS: "Invalid credentials.",
  },
  createRequestAuthClient: mocks.createRequestAuthClient,
  establishApplicationSession: mocks.establishApplicationSession,
  getDeviceContext: mocks.getDeviceContext,
  getLoginUser: mocks.getLoginUser,
  selectLoginAuthority: mocks.selectLoginAuthority,
  signOutSafely: mocks.signOutSafely,
}));

import { loginAction } from "./actions";

const platformUserId = "91000000-0000-4000-8000-000000000001";
const clinicId = "20000000-0000-4000-8000-000000000001";
const redirectSignal = new Error("NEXT_REDIRECT");

function form(): FormData {
  const value = new FormData();
  value.set("email", "owner@auth.example.test");
  value.set("password", "synthetic-password");
  value.set("scope", "clinic");
  return value;
}

describe("loginAction application scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRequestAuthClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    mocks.getDeviceContext.mockResolvedValue({
      deviceLabel: "Browser",
      userAgentHash: "safe-hash",
    });
    mocks.establishApplicationSession.mockResolvedValue({ id: "synthetic-session" });
    mocks.redirect.mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it("creates platform scope and redirects a bootstrap-only Platform Owner", async () => {
    mocks.getLoginUser.mockResolvedValue({
      clinicId: null,
      hasPlatformOwnerAuthority: true,
      platformUserId,
    });
    mocks.selectLoginAuthority.mockReturnValue({
      authorityScope: "platform",
      destination: "/platform",
    });

    await expect(loginAction({}, form())).rejects.toBe(redirectSignal);
    expect(mocks.establishApplicationSession).toHaveBeenCalledWith({
      authorityScope: "platform",
      deviceLabel: "Browser",
      platformUserId,
      userAgentHash: "safe-hash",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/platform");
  });

  it("preserves clinic scope for clinic-only users", async () => {
    mocks.getLoginUser.mockResolvedValue({
      clinicId,
      hasPlatformOwnerAuthority: false,
      platformUserId,
    });
    mocks.selectLoginAuthority.mockReturnValue({
      authorityScope: "clinic",
      clinicId,
      destination: "/clinic",
    });

    await expect(loginAction({}, form())).rejects.toBe(redirectSignal);
    expect(mocks.establishApplicationSession).toHaveBeenCalledWith(
      expect.objectContaining({ authorityScope: "clinic", clinicId }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/clinic");
  });

  it("ignores forged browser scope and uses only the server-selected authority", async () => {
    mocks.getLoginUser.mockResolvedValue({
      clinicId: null,
      hasPlatformOwnerAuthority: true,
      platformUserId,
    });
    mocks.selectLoginAuthority.mockReturnValue({
      authorityScope: "platform",
      destination: "/platform",
    });

    await expect(loginAction({}, form())).rejects.toBe(redirectSignal);
    expect(mocks.establishApplicationSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ authorityScope: "clinic" }),
    );
  });
});
