// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { getClientEnvironment } from "./client";

describe("getClientEnvironment", () => {
  const localEnvironment = {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  };

  it("returns only the allowlisted public Auth environment", () => {
    expect(globalThis).toHaveProperty("document");
    expect(getClientEnvironment(localEnvironment)).toEqual(localEnvironment);
  });

  it("rejects server-only and unknown public values", () => {
    expect(() =>
      getClientEnvironment({ ...localEnvironment, NODE_ENV: "production" }),
    ).toThrowError(/Invalid client environment/);
    expect(() => getClientEnvironment({ ...localEnvironment, APP_ENV: "local" })).toThrowError(
      /Invalid client environment/,
    );
    expect(() =>
      getClientEnvironment({ ...localEnvironment, NEXT_PUBLIC_UNKNOWN: "synthetic" }),
    ).toThrowError(/Invalid client environment/);
  });

  it("requires a valid URL and non-whitespace publishable key", () => {
    expect(() =>
      getClientEnvironment({
        ...localEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() =>
      getClientEnvironment({
        ...localEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic key with whitespace",
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("does not mutate its input", () => {
    const values = { ...localEnvironment };

    expect(getClientEnvironment(values)).toEqual(localEnvironment);
    expect(values).toEqual(localEnvironment);
  });
});
