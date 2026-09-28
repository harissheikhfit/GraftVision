import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";

import { getSessionEnvironment } from "@graftvision/config/env/session";

export const SESSION_COOKIE_NAME = "gv_session";

function getSigningKey(): string {
  const env = getSessionEnvironment();
  return env.APPLICATION_SESSION_SIGNING_KEY;
}

function getPreviousSigningKey(): string | undefined {
  const env = getSessionEnvironment();
  return env.APPLICATION_SESSION_PREVIOUS_SIGNING_KEY;
}

export function signSessionId(sessionId: string): string {
  const hmac = createHmac("sha256", getSigningKey());
  hmac.update(sessionId);
  const signature = hmac.digest("base64url");
  return `v1.${sessionId}.${signature}`;
}

function verifyWithKey(sessionId: string, signature: string, key: string): boolean {
  const expectedSignature = createHmac("sha256", key).update(sessionId).digest("base64url");

  try {
    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function verifySessionId(signedCookieValue: string): string | null {
  const parts = signedCookieValue.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const version = parts[0];
  const sessionId = parts[1];
  const signature = parts[2];

  if (version !== "v1" || !sessionId || !signature) {
    return null;
  }

  // Try current key
  if (verifyWithKey(sessionId, signature, getSigningKey())) {
    return sessionId;
  }

  // Try previous key if available
  const prevKey = getPreviousSigningKey();
  if (prevKey && verifyWithKey(sessionId, signature, prevKey)) {
    return sessionId;
  }

  return null;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const env = getSessionEnvironment();
  const signedValue = signSessionId(sessionId);

  const absoluteMaxAgeSeconds = env.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedValue, {
    httpOnly: true,
    secure: env.APP_ENV !== "local" && env.APP_ENV !== "test",
    sameSite: "lax",
    path: "/",
    maxAge: absoluteMaxAgeSeconds, // bounded absolute max age
  });
}

export async function clearSessionCookie(): Promise<void> {
  const env = getSessionEnvironment();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.APP_ENV !== "local" && env.APP_ENV !== "test",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // delete immediately
  });
}

export type SessionCookieState =
  | { readonly status: "invalid" }
  | { readonly status: "missing" }
  | { readonly sessionId: string; readonly status: "valid" };

export async function inspectSessionCookie(): Promise<SessionCookieState> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) {
    return { status: "missing" };
  }

  const sessionId = verifySessionId(cookie.value);
  return sessionId ? { sessionId, status: "valid" } : { status: "invalid" };
}

export async function getSessionCookieId(): Promise<string | null> {
  const state = await inspectSessionCookie();
  return state.status === "valid" ? state.sessionId : null;
}
