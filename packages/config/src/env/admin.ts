import "server-only";

import { z } from "zod";

import { getAuthEnvironment, type AuthEnvironment } from "./auth";
import { optionalEnvironmentString } from "./parsers";
import { validateEnvironment } from "./validation";

const adminEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalEnvironmentString.pipe(z.string().min(1, "is required")),
});

export interface AdminAuthEnvironment extends AuthEnvironment {
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

export function getAdminAuthEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): AdminAuthEnvironment {
  const auth = getAuthEnvironment(values);
  const admin = validateEnvironment(adminEnvironmentSchema, values, "admin");

  return {
    ...auth,
    SUPABASE_SERVICE_ROLE_KEY: admin.SUPABASE_SERVICE_ROLE_KEY,
  };
}
