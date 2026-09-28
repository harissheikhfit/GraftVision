import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { getSessionEnvironment } from "@graftvision/config/env/session";
import { createDatabasePool, hashScanToken, redeemScanSessionToken } from "@graftvision/database";

const scanOrigin = "http://localhost:3001";

function response(body: Record<string, string>, status: number): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": scanOrigin,
      vary: "Origin",
    },
    status,
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-origin": scanOrigin,
      vary: "Origin",
    },
  });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== scanOrigin)
    return response({ error: "SCAN_PAIRING_DENIED" }, 403);
  let token = "";
  try {
    const body: unknown = await request.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "token" in body &&
      typeof body.token === "string"
    ) {
      token = body.token;
    }
  } catch {
    return response({ error: "SCAN_PAIRING_DENIED" }, 400);
  }
  if (!token || token.length > 256) return response({ error: "SCAN_PAIRING_DENIED" }, 400);
  try {
    const authClient = await createRequestAuthClient();
    await requireVerifiedAuthSession(authClient, "clinic");
    const [session, user] = await Promise.all([
      getActiveApplicationSession(),
      getCurrentUser(authClient),
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
      return response({ error: "SCAN_PAIRING_DENIED" }, 403);
    }
    const pool = createDatabasePool();
    try {
      const result = await redeemScanSessionToken(pool, {
        applicationSessionId: session.id,
        idempotencyKey: randomUUID(),
        pairingNonce: randomBytes(32).toString("base64url"),
        providerIdentityId: user.platformUserId,
        tokenHash: hashScanToken(token, getSessionEnvironment().APPLICATION_SESSION_SIGNING_KEY),
      });
      return response({ scanSessionId: result.id, status: "paired" }, 200);
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return response({ error: "SCAN_PAIRING_DENIED" }, 403);
  }
}
