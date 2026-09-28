import "server-only";

import { getClientEnvironment } from "./client";
import { getServerEnvironment } from "./server";

const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);

export interface AuthEnvironment {
  readonly APP_ENV: "local" | "production" | "staging" | "test";
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
}

export function getAuthEnvironment(values: NodeJS.ProcessEnv = process.env): AuthEnvironment {
  const server = getServerEnvironment(values);
  const client = getClientEnvironment({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: values.NEXT_PUBLIC_SUPABASE_URL,
  });
  const url = new URL(client.NEXT_PUBLIC_SUPABASE_URL);
  const isLoopback = loopbackHosts.has(url.hostname);

  if ((server.APP_ENV === "local" || server.APP_ENV === "test") && !isLoopback) {
    throw new Error("Local and test Auth configuration must use a loopback host.");
  }

  if ((server.APP_ENV === "staging" || server.APP_ENV === "production") && isLoopback) {
    throw new Error("Staging and production Auth configuration cannot use local values.");
  }

  return {
    APP_ENV: server.APP_ENV,
    ...client,
  };
}
