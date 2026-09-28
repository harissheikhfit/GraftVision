import { NextResponse, type NextRequest } from "next/server";

import {
  createRequestAuthClient,
  recordSuccessfulApplicationActivity,
} from "@graftvision/auth/server";

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "REQUEST_DENIED" }, { status: 403 });
  }

  const client = await createRequestAuthClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "AUTH_SESSION_REQUIRED" }, { status: 401 });
  }

  const recorded = await recordSuccessfulApplicationActivity(data.user.id);
  return recorded
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "AUTH_SESSION_REQUIRED" }, { status: 401 });
}
