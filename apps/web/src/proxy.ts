import { refreshAuthSession } from "@graftvision/auth/server";

import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return refreshAuthSession(request);
}

export const config = {
  matcher: ["/login", "/locked", "/clinic/:path*", "/platform/:path*"],
};
