import { describe, expect, it } from "vitest";

import { getServerEnvironment } from "./server";

describe("getServerEnvironment", () => {
  it("uses the safe local default in development", () => {
    expect(globalThis).not.toHaveProperty("document");
    expect(getServerEnvironment({ NODE_ENV: "development" })).toEqual({
      APP_ENV: "local",
      NODE_ENV: "development",
    });
  });

  it.each([
    [{ APP_ENV: "local", NODE_ENV: "development" }, "local"],
    [{ APP_ENV: "test", NODE_ENV: "test" }, "test"],
    [{ APP_ENV: "staging", NODE_ENV: "production" }, "staging"],
    [{ APP_ENV: "production", NODE_ENV: "production" }, "production"],
  ] as const)("accepts a valid deployment context", (values, expectedApplicationEnvironment) => {
    expect(getServerEnvironment(values).APP_ENV).toBe(expectedApplicationEnvironment);
  });

  it("uses the safe test default in test mode", () => {
    expect(getServerEnvironment({ NODE_ENV: "test" })).toEqual({
      APP_ENV: "test",
      NODE_ENV: "test",
    });
  });

  it("parses a runtime-provided CI boolean", () => {
    expect(getServerEnvironment({ APP_ENV: "test", CI: "false", NODE_ENV: "test" })).toMatchObject({
      CI: false,
    });
  });

  it("rejects unsupported NODE_ENV and APP_ENV values", () => {
    expect(() => getServerEnvironment({ NODE_ENV: "preview" })).toThrowError(
      /Invalid server environment: NODE_ENV/,
    );
    expect(() => getServerEnvironment({ APP_ENV: "preview", NODE_ENV: "production" })).toThrowError(
      /Invalid server environment: APP_ENV/,
    );
  });

  it("normalises an empty APP_ENV and rejects production without an explicit context", () => {
    expect(() => getServerEnvironment({ APP_ENV: "", NODE_ENV: "production" })).toThrowError(
      /APP_ENV: is required when NODE_ENV is production/,
    );
    expect(() => getServerEnvironment({ NODE_ENV: "production" })).toThrowError(
      /APP_ENV: is required when NODE_ENV is production/,
    );
  });

  it("rejects incompatible framework and deployment contexts", () => {
    expect(() => getServerEnvironment({ APP_ENV: "local", NODE_ENV: "production" })).toThrowError(
      /APP_ENV: is incompatible with NODE_ENV=production/,
    );
    expect(() =>
      getServerEnvironment({ APP_ENV: "production", NODE_ENV: "development" }),
    ).toThrowError(/APP_ENV: is incompatible with NODE_ENV=development/);
  });
});
