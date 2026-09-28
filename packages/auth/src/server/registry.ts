import "server-only";

import { getSessionEnvironment } from "@graftvision/config/env/session";
import {
  type ApplicationSession,
  createApplicationSession,
  createDatabasePool,
  getApplicationSession,
  getApplicationSessionState,
  lockApplicationSession,
  logoutLockedApplicationSession,
  recordApplicationSessionActivity,
  recordSessionReauthenticationFailed,
  revokeAllOtherApplicationSessions,
  revokeApplicationSession,
  rotateApplicationSessionAuthority,
  unlockApplicationSession,
} from "@graftvision/database";

import {
  clearSessionCookie,
  getSessionCookieId,
  inspectSessionCookie,
  setSessionCookie,
} from "./cookies";

type SessionAuthoritySelection =
  | { readonly authorityScope: "clinic"; readonly clinicId: string }
  | { readonly authorityScope: "platform"; readonly clinicId?: never };

export async function establishApplicationSession(
  params: {
    platformUserId: string;
    providerSessionId?: string;
    deviceLabel: string;
    userAgentHash?: string;
  } & SessionAuthoritySelection,
): Promise<ApplicationSession> {
  const env = getSessionEnvironment();
  const absoluteExpiresAt = new Date(
    Date.now() + env.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000,
  );

  const pool = createDatabasePool();
  try {
    const authority =
      params.authorityScope === "clinic"
        ? { authorityScope: "clinic" as const, clinicId: params.clinicId }
        : { authorityScope: "platform" as const };
    const session = await createApplicationSession(pool, {
      platformUserId: params.platformUserId,
      ...authority,
      ...(params.providerSessionId === undefined
        ? {}
        : { providerSessionId: params.providerSessionId }),
      absoluteExpiresAt,
      deviceLabel: params.deviceLabel,
      ...(params.userAgentHash === undefined ? {} : { userAgentHash: params.userAgentHash }),
    });

    await setSessionCookie(session.id);
    return session;
  } finally {
    await pool.end();
  }
}

export async function switchApplicationSessionAuthority(
  params: {
    readonly providerIdentityId: string;
    readonly deviceLabel: string;
    readonly userAgentHash?: string;
  } & SessionAuthoritySelection,
): Promise<ApplicationSession> {
  const currentSessionId = await getSessionCookieId();
  if (!currentSessionId) {
    throw new Error("AUTH_SESSION_REQUIRED");
  }

  const env = getSessionEnvironment();
  const absoluteExpiresAt = new Date(
    Date.now() + env.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000,
  );
  const pool = createDatabasePool();
  try {
    const common = {
      currentSessionId,
      providerIdentityId: params.providerIdentityId,
      absoluteExpiresAt,
      deviceLabel: params.deviceLabel,
      ...(params.userAgentHash === undefined ? {} : { userAgentHash: params.userAgentHash }),
    };
    const session =
      params.authorityScope === "clinic"
        ? await rotateApplicationSessionAuthority(pool, {
            ...common,
            authorityScope: "clinic",
            clinicId: params.clinicId,
          })
        : await rotateApplicationSessionAuthority(pool, {
            ...common,
            authorityScope: "platform",
          });
    await setSessionCookie(session.id);
    return session;
  } finally {
    await pool.end();
  }
}

export async function getActiveApplicationSession(): Promise<ApplicationSession | null> {
  const state = await getCurrentApplicationSessionState();
  return state?.status === "active" ? state.session : null;
}

export type CurrentApplicationSessionState =
  | { readonly session: ApplicationSession; readonly status: "active" }
  | { readonly session: ApplicationSession; readonly status: "expired" }
  | { readonly session: ApplicationSession; readonly status: "locked" }
  | { readonly session: ApplicationSession; readonly status: "revoked" }
  | { readonly session: ApplicationSession; readonly status: "stale" }
  | { readonly status: "invalid" }
  | { readonly status: "stale" };

export async function getCurrentApplicationSessionState(): Promise<CurrentApplicationSessionState | null> {
  const cookieState = await inspectSessionCookie();
  if (cookieState.status === "missing") {
    return null;
  }
  if (cookieState.status === "invalid") {
    return { status: "invalid" };
  }
  const { sessionId } = cookieState;

  const pool = createDatabasePool();
  try {
    let session = await getApplicationSessionState(pool, sessionId);
    if (!session) {
      return { status: "stale" };
    }

    if (session.revokedAt) {
      return { session, status: "revoked" };
    }

    const now = new Date();
    if (now >= session.absoluteExpiresAt) {
      await revokeApplicationSession(pool, sessionId, "LOGOUT", session.platformUserId);
      return { session, status: "expired" };
    }

    if (session.lockedAt) {
      return { session, status: "locked" };
    }

    const env = getSessionEnvironment();
    const idleLocksAt = new Date(
      session.lastActivityAt.getTime() + env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000,
    );

    if (now >= idleLocksAt) {
      await lockApplicationSession(pool, {
        providerIdentityId: session.platformUserId,
        reasonCode: "IDLE",
        sessionId,
      });
      session = (await getApplicationSessionState(pool, sessionId)) ?? session;
      return { session, status: "locked" };
    }

    const activeSession = await getApplicationSession(pool, sessionId);
    return activeSession
      ? { session: activeSession, status: "active" }
      : { session, status: "stale" };
  } finally {
    await pool.end();
  }
}

export async function recordSuccessfulApplicationActivity(
  providerIdentityId: string,
): Promise<boolean> {
  const env = getSessionEnvironment();

  // Requirement: require a valid active application session.
  // Read-time resolution denies idle, stale, revoked, and expired sessions without mutating cookies.
  const session = await getActiveApplicationSession();
  if (!session) {
    return false;
  }

  const pool = createDatabasePool();
  try {
    const now = new Date();
    const msSinceLastActivity = now.getTime() - session.lastActivityAt.getTime();
    const updateIntervalMs = env.SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS * 1000;

    // Requirement: obey SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS
    if (msSinceLastActivity >= updateIntervalMs) {
      return await recordApplicationSessionActivity(pool, session.id, providerIdentityId);
    }
    return true;
  } finally {
    await pool.end();
  }
}

export async function lockCurrentApplicationSession(
  providerIdentityId: string,
  reasonCode: "IDLE" | "MANUAL",
): Promise<boolean> {
  const sessionId = await getSessionCookieId();
  if (!sessionId) {
    return false;
  }

  const pool = createDatabasePool();
  try {
    return await lockApplicationSession(pool, { providerIdentityId, reasonCode, sessionId });
  } finally {
    await pool.end();
  }
}

export async function unlockCurrentApplicationSession(
  providerIdentityId: string,
): Promise<ApplicationSession | null> {
  const sessionId = await getSessionCookieId();
  if (!sessionId) {
    return null;
  }

  const pool = createDatabasePool();
  try {
    const session = await getApplicationSessionState(pool, sessionId);
    if (!session?.lockedAt || session.platformUserId !== providerIdentityId) {
      return null;
    }

    const unlocked = await unlockApplicationSession(pool, {
      clinicId: session.clinicId,
      expectedScope: session.authorityScope,
      providerIdentityId,
      sessionId,
    });
    return unlocked ? await getApplicationSession(pool, sessionId) : null;
  } finally {
    await pool.end();
  }
}

export async function recordCurrentSessionReauthenticationFailed(
  providerIdentityId: string,
): Promise<void> {
  const sessionId = await getSessionCookieId();
  if (!sessionId) {
    return;
  }
  const pool = createDatabasePool();
  try {
    await recordSessionReauthenticationFailed(pool, sessionId, providerIdentityId);
  } finally {
    await pool.end();
  }
}

export async function terminateLockedSession(providerIdentityId: string): Promise<void> {
  const sessionId = await getSessionCookieId();
  if (!sessionId) {
    await clearSessionCookie();
    return;
  }
  const pool = createDatabasePool();
  try {
    await logoutLockedApplicationSession(pool, sessionId, providerIdentityId);
    await clearSessionCookie();
  } finally {
    await pool.end();
  }
}

export async function terminateCurrentSession(): Promise<void> {
  const sessionId = await getSessionCookieId();
  if (!sessionId) {
    await clearSessionCookie();
    return;
  }

  const pool = createDatabasePool();
  try {
    await revokeApplicationSession(pool, sessionId, "LOGOUT");
    await clearSessionCookie();
  } finally {
    await pool.end();
  }
}

export async function terminateOtherSession(
  sessionIdToRevoke: string,
  providerIdentityId: string,
): Promise<void> {
  const currentSessionId = await getSessionCookieId();
  const pool = createDatabasePool();
  try {
    const sessionToRevoke = await getApplicationSession(pool, sessionIdToRevoke);
    const currentSession = currentSessionId
      ? await getApplicationSession(pool, currentSessionId)
      : null;

    if (
      sessionToRevoke &&
      currentSession &&
      currentSession.platformUserId === providerIdentityId &&
      sessionToRevoke.platformUserId === currentSession.platformUserId
    ) {
      await revokeApplicationSession(
        pool,
        sessionIdToRevoke,
        "REVOKE_ONE",
        currentSession.platformUserId,
      );
    }
  } finally {
    await pool.end();
  }
}

export async function terminateAllOtherSessions(providerIdentityId: string): Promise<void> {
  const currentSessionId = await getSessionCookieId();
  if (!currentSessionId) {
    return;
  }

  const pool = createDatabasePool();
  try {
    const currentSession = await getApplicationSession(pool, currentSessionId);
    if (currentSession?.platformUserId === providerIdentityId) {
      await revokeAllOtherApplicationSessions(
        pool,
        currentSession.platformUserId,
        currentSessionId,
      );
    }
  } finally {
    await pool.end();
  }
}
