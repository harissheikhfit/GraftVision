"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnvironment } from "@graftvision/config/env/client";

export function createAuthBrowserClient() {
  const environment = getClientEnvironment();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { path: "/", sameSite: "lax" },
      cookies: { encode: "tokens-only" },
    },
  );
}
