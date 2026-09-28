import { describe, expect, it } from "vitest";

import { getAdminAuthEnvironment } from "./admin";

const local = {
  APP_ENV: "local",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NODE_ENV: "development",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
};

describe("getAdminAuthEnvironment", () => {
  it("includes SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(getAdminAuthEnvironment(local)).toHaveProperty(
      "SUPABASE_SERVICE_ROLE_KEY",
      "synthetic-service-key",
    );
  });

  it("throws if SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _SUPABASE_SERVICE_ROLE_KEY, ...missingKey } = local;
    expect(() => getAdminAuthEnvironment(missingKey)).toThrowError(
      "Invalid admin environment: SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
