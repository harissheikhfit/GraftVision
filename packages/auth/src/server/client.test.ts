import { describe, expect, it } from "vitest";

import { createAuthServerClient } from "./client";

describe("createAuthServerClient", () => {
  it("creates a request-scoped client without exposing configuration", () => {
    const client = createAuthServerClient(
      {
        getAll: () => [],
        set: () => undefined,
      },
      {
        APP_ENV: "test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      },
    );

    expect(client.auth).toBeDefined();
    expect(client).not.toHaveProperty("serviceRoleKey");
  });
});
