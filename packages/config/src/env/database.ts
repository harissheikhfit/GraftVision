import "server-only";

import { z } from "zod";

import { environmentUrl } from "./parsers";
import { getServerEnvironment } from "./server";
import { validateEnvironment } from "./validation";

const databaseEnvironmentInputSchema = z.object({
  SUPABASE_DB_URL: environmentUrl.refine((value) => {
    if (!URL.canParse(value)) {
      return false;
    }

    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }, "must use the postgres or postgresql protocol"),
});

export interface DatabaseEnvironment {
  readonly APP_ENV: "local" | "production" | "staging" | "test";
  readonly SUPABASE_DB_URL: string;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

export function getDatabaseEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): DatabaseEnvironment {
  const serverEnvironment = getServerEnvironment(values);
  const databaseEnvironment = validateEnvironment(
    databaseEnvironmentInputSchema,
    values,
    "database",
  );
  const databaseUrl = new URL(databaseEnvironment.SUPABASE_DB_URL);
  const isLocalDatabase = isLoopbackHost(databaseUrl.hostname);

  if (
    (serverEnvironment.APP_ENV === "local" || serverEnvironment.APP_ENV === "test") &&
    !isLocalDatabase
  ) {
    throw new Error("Local and test database configuration must use a loopback host.");
  }

  if (
    (serverEnvironment.APP_ENV === "staging" || serverEnvironment.APP_ENV === "production") &&
    isLocalDatabase
  ) {
    throw new Error("Staging and production database configuration cannot use local credentials.");
  }

  return {
    APP_ENV: serverEnvironment.APP_ENV,
    SUPABASE_DB_URL: databaseEnvironment.SUPABASE_DB_URL,
  };
}
