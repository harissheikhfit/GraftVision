import { describe, expect, it } from "vitest";

import { getAuthEnvironment } from "./auth";

const local = {
  APP_ENV: "local",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NODE_ENV: "development",
};

describe("getAuthEnvironment", () => {
  it("accepts the loopback local Auth endpoint", () => {
    expect(getAuthEnvironment(local)).toEqual({
      APP_ENV: "local",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
  });

  it("rejects remote Auth in local development", () => {
    expect(() =>
      getAuthEnvironment({
        ...local,
        NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
      }),
    ).toThrowError("Local and test Auth configuration must use a loopback host.");
  });

  it("rejects loopback Auth in production", () => {
    expect(() =>
      getAuthEnvironment({
        ...local,
        APP_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toThrowError("Staging and production Auth configuration cannot use local values.");
  });

  it("never includes database or administrative credentials", () => {
    expect(
      getAuthEnvironment({
        ...local,
        SUPABASE_DB_URL: "postgresql://synthetic:synthetic@127.0.0.1:54322/postgres",
        SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      }),
    ).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });
});
