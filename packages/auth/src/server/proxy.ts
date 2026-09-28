import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthEnvironment } from "@graftvision/config/env/auth";

import { SESSION_COOKIE_NAME } from "./cookies";
import { getCurrentApplicationSessionState } from "./registry";

export async function refreshAuthSession(request: NextRequest): Promise<NextResponse> {
  const environment = getAuthEnvironment();
  let response = NextResponse.next({ request });
  const secure = environment.APP_ENV === "production" || environment.APP_ENV === "staging";
  const client = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure,
      },
      cookies: {
        encode: "tokens-only",
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }

          response = NextResponse.next({ request });

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, {
              ...cookie.options,
              httpOnly: true,
              path: "/",
              sameSite: "lax",
              secure,
            });
          }

          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await client.auth.getUser();

  // If there's an authenticated provider user on a protected route, verify application session
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/clinic") ||
    request.nextUrl.pathname.startsWith("/platform");
  const isLockRoute = request.nextUrl.pathname === "/locked";

  if (user && (isProtectedRoute || isLockRoute)) {
    const sessionState = await getCurrentApplicationSessionState();
    const appSession =
      sessionState?.status === "active" || sessionState?.status === "locked"
        ? sessionState.session
        : null;

    if (sessionState?.status === "locked") {
      if (!isLockRoute) {
        const lockUrl = request.nextUrl.clone();
        lockUrl.pathname = "/locked";
        lockUrl.search = "";
        return NextResponse.redirect(lockUrl);
      }
      return response;
    }

    if (isLockRoute && sessionState?.status === "active") {
      const destination = request.nextUrl.clone();
      destination.pathname = appSession?.authorityScope === "platform" ? "/platform" : "/clinic";
      destination.search = "";
      return NextResponse.redirect(destination);
    }

    const requiredScope = request.nextUrl.pathname.startsWith("/platform") ? "platform" : "clinic";
    const hasRequiredAuthority =
      appSession?.platformUserId === user.id &&
      appSession.authorityScope === requiredScope &&
      (requiredScope === "platform" ? appSession.clinicId === null : appSession.clinicId !== null);

    if (!hasRequiredAuthority) {
      await client.auth.signOut({ scope: "local" });

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      const redirectResponse = NextResponse.redirect(loginUrl);

      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      redirectResponse.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure,
      });

      return redirectResponse;
    }
  }

  return response;
}
