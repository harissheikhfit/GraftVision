import { describe, expect, it } from "vitest";

import { getDatabaseEnvironment } from "./database";

const localDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("getDatabaseEnvironment", () => {
  it("accepts the repository local database URL", () => {
    expect(
      getDatabaseEnvironment({
        APP_ENV: "local",
        NODE_ENV: "development",
        SUPABASE_DB_URL: localDatabaseUrl,
      }),
    ).toEqual({
      APP_ENV: "local",
      SUPABASE_DB_URL: localDatabaseUrl,
    });
  });

  it("requires the server-only database URL", () => {
    expect(() =>
      getDatabaseEnvironment({ APP_ENV: "local", NODE_ENV: "development" }),
    ).toThrowError(/SUPABASE_DB_URL/);
  });

  it.each(["not-a-url", "urn:graftvision:database"])(
    "rejects an invalid PostgreSQL URL: %s",
    (SUPABASE_DB_URL) => {
      expect(() =>
        getDatabaseEnvironment({
          APP_ENV: "local",
          NODE_ENV: "development",
          SUPABASE_DB_URL,
        }),
      ).toThrowError(/Invalid database environment/);
    },
  );

  it("does not expose a remote database to local development", () => {
    expect(() =>
      getDatabaseEnvironment({
        APP_ENV: "local",
        NODE_ENV: "development",
        SUPABASE_DB_URL: "postgresql://user:password@db.example.test:5432/postgres",
      }),
    ).toThrowError(/must use a loopback host/);
  });

  it("does not accept local credentials in production", () => {
    expect(() =>
      getDatabaseEnvironment({
        APP_ENV: "production",
        NODE_ENV: "production",
        SUPABASE_DB_URL: localDatabaseUrl,
      }),
    ).toThrowError(/cannot use local credentials/);
  });

  it("redacts the supplied value from validation errors", () => {
    const secretLikeValue = "not-a-url-with-secret-material";

    try {
      getDatabaseEnvironment({
        APP_ENV: "local",
        NODE_ENV: "development",
        SUPABASE_DB_URL: secretLikeValue,
      });
      expect.unreachable("invalid database configuration must throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);

      if (error instanceof Error) {
        expect(error.message).not.toContain(secretLikeValue);
      }
    }
  });
});
