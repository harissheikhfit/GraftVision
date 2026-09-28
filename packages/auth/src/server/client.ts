import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getAuthEnvironment, type AuthEnvironment } from "@graftvision/config/env/auth";

interface CookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
}

function protectedCookieOptions(
  environment: AuthEnvironment,
  options: CookieOptions,
): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: environment.APP_ENV === "production" || environment.APP_ENV === "staging",
  };
}

export function createAuthServerClient(
  cookieStore: CookieStore,
  environment: AuthEnvironment = getAuthEnvironment(),
) {
  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: protectedCookieOptions(environment, {}),
      cookies: {
        encode: "tokens-only",
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) {
            cookieStore.set(
              cookie.name,
              cookie.value,
              protectedCookieOptions(environment, cookie.options),
            );
          }
        },
      },
    },
  );
}

export async function createRequestAuthClient() {
  return createAuthServerClient(await cookies());
}
