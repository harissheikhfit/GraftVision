import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationSession } from "@graftvision/database";

const cookieMocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  getSessionCookieId: vi.fn(),
  inspectSessionCookie: vi.fn(),
  setSessionCookie: vi.fn(),
}));
const databaseMocks = vi.hoisted(() => ({
  createApplicationSession: vi.fn(),
  createDatabasePool: vi.fn(),
  getApplicationSession: vi.fn(),
  getApplicationSessionState: vi.fn(),
  lockApplicationSession: vi.fn(),
  logoutLockedApplicationSession: vi.fn(),
  recordApplicationSessionActivity: vi.fn(),
  recordSessionReauthenticationFailed: vi.fn(),
  revokeAllOtherApplicationSessions: vi.fn(),
  revokeApplicationSession: vi.fn(),
  rotateApplicationSessionAuthority: vi.fn(),
  unlockApplicationSession: vi.fn(),
}));

vi.mock("./cookies", () => cookieMocks);
vi.mock("@graftvision/database", () => databaseMocks);
vi.mock("@graftvision/config/env/session", () => ({
  getSessionEnvironment: () => ({
    SESSION_ABSOLUTE_TIMEOUT_HOURS: 12,
    SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: 60,
    SESSION_IDLE_TIMEOUT_MINUTES: 30,
  }),
}));

import { getCurrentApplicationSessionState, terminateCurrentSession } from "./registry";

const now = new Date();
const session: ApplicationSession = {
  absoluteExpiresAt: new Date(now.getTime() + 60_000),
  authorityScope: "platform",
  clinicAuthorizationVersion: null,
  clinicId: null,
  createdAt: now,
  deviceLabel: "Synthetic browser",
  id: "51000000-0000-4000-8000-000000000001",
  lastActivityAt: now,
  lockedAt: null,
  lockReasonCode: null,
  platformAuthorizationVersion: 1,
  platformUserId: "51000000-0000-4000-8000-000000000002",
  providerSessionId: null,
  reauthenticatedAt: null,
  revokeReasonCode: null,
  revokedAt: null,
  updatedAt: now,
  userAgentHash: null,
};

describe("read-only application session resolution", () => {
  beforeEach(() => {
    databaseMocks.createDatabasePool.mockReturnValue({
      end: vi.fn().mockResolvedValue(undefined),
    });
    cookieMocks.inspectSessionCookie.mockResolvedValue({
      sessionId: session.id,
      status: "valid",
    });
    databaseMocks.getApplicationSessionState.mockResolvedValue(session);
    databaseMocks.getApplicationSession.mockResolvedValue(session);
  });

  it("returns an invalid state without clearing a malformed cookie", async () => {
    cookieMocks.inspectSessionCookie.mockResolvedValue({ status: "invalid" });

    await expect(getCurrentApplicationSessionState()).resolves.toEqual({ status: "invalid" });
    expect(databaseMocks.createDatabasePool).not.toHaveBeenCalled();
    expect(cookieMocks.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("returns stale when the signed session no longer exists without mutating cookies", async () => {
    databaseMocks.getApplicationSessionState.mockResolvedValue(null);

    await expect(getCurrentApplicationSessionState()).resolves.toEqual({ status: "stale" });
    expect(cookieMocks.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("returns revoked without mutating cookies", async () => {
    databaseMocks.getApplicationSessionState.mockResolvedValue({ ...session, revokedAt: now });

    await expect(getCurrentApplicationSessionState()).resolves.toMatchObject({
      status: "revoked",
    });
    expect(cookieMocks.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("preserves expiry revocation evidence without mutating cookies", async () => {
    databaseMocks.getApplicationSessionState.mockResolvedValue({
      ...session,
      absoluteExpiresAt: new Date(now.getTime() - 1),
    });

    await expect(getCurrentApplicationSessionState()).resolves.toMatchObject({
      status: "expired",
    });
    expect(databaseMocks.revokeApplicationSession).toHaveBeenCalledOnce();
    expect(cookieMocks.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("returns locked without mutating cookies", async () => {
    databaseMocks.getApplicationSessionState.mockResolvedValue({
      ...session,
      lockedAt: now,
      lockReasonCode: "MANUAL",
    });

    await expect(getCurrentApplicationSessionState()).resolves.toMatchObject({ status: "locked" });
    expect(cookieMocks.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("clears an invalid application cookie from the explicit logout boundary", async () => {
    cookieMocks.getSessionCookieId.mockResolvedValue(null);

    await terminateCurrentSession();

    expect(cookieMocks.clearSessionCookie).toHaveBeenCalledOnce();
    expect(databaseMocks.revokeApplicationSession).not.toHaveBeenCalled();
  });
});
