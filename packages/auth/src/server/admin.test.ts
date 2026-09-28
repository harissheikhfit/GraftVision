import { describe, expect, it } from "vitest";

import { createAuthAdminClient } from "./admin";

describe("createAuthAdminClient", () => {
  it("creates a Supabase admin client", () => {
    const client = createAuthAdminClient({
      APP_ENV: "local",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    expect(client).toBeDefined();
    expect(client.auth.admin).toBeDefined();
  });
});
