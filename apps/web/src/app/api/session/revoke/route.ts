import { NextResponse, type NextRequest } from "next/server";

import { createRequestAuthClient, terminateOtherSession } from "@graftvision/auth/server";

const opaqueSessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "REQUEST_DENIED" }, { status: 403 });
  }

  const client = await createRequestAuthClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "AUTH_SESSION_REQUIRED" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "sessionId" in body &&
    typeof body.sessionId === "string" &&
    opaqueSessionIdPattern.test(body.sessionId)
  ) {
    await terminateOtherSession(body.sessionId, data.user.id);
  }
  return NextResponse.json({ success: true });
}
