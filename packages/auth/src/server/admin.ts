import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getAdminAuthEnvironment, type AdminAuthEnvironment } from "@graftvision/config/env/admin";

export function createAuthAdminClient(
  environment: AdminAuthEnvironment = getAdminAuthEnvironment(),
) {
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
