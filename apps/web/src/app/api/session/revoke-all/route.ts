import { NextResponse, type NextRequest } from "next/server";

import { createRequestAuthClient, terminateAllOtherSessions } from "@graftvision/auth/server";

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

  await terminateAllOtherSessions(data.user.id);
  return NextResponse.json({ success: true });
}
