import { describe, expect, it } from "vitest";

import { getSessionEnvironment } from "./session";

describe("getSessionEnvironment", () => {
  it("parses valid session environment values", () => {
    const env = getSessionEnvironment({
      APP_ENV: "local",
      SESSION_IDLE_TIMEOUT_MINUTES: "45",
      SESSION_IDLE_WARNING_MINUTES: "25",
      SESSION_ABSOLUTE_TIMEOUT_HOURS: "24",
      SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: "120",
      SESSION_CLOCK_SKEW_SECONDS: "60",
      APPLICATION_SESSION_SIGNING_KEY: "01234567890123456789012345678901",
    });

    expect(env.APP_ENV).toBe("local");
    expect(env.SESSION_IDLE_TIMEOUT_MINUTES).toBe(45);
    expect(env.SESSION_IDLE_WARNING_MINUTES).toBe(25);
    expect(env.SESSION_ABSOLUTE_TIMEOUT_HOURS).toBe(24);
    expect(env.SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS).toBe(120);
    expect(env.SESSION_CLOCK_SKEW_SECONDS).toBe(60);
    expect(env.APPLICATION_SESSION_SIGNING_KEY).toBe("01234567890123456789012345678901");
  });

  it("applies default values for optional configurations", () => {
    const env = getSessionEnvironment({
      APP_ENV: "production",
      NODE_ENV: "production",
      APPLICATION_SESSION_SIGNING_KEY: "01234567890123456789012345678901",
    });

    expect(env.APP_ENV).toBe("production");
    expect(env.SESSION_IDLE_TIMEOUT_MINUTES).toBe(30);
    expect(env.SESSION_IDLE_WARNING_MINUTES).toBe(25);
    expect(env.SESSION_ABSOLUTE_TIMEOUT_HOURS).toBe(12);
    expect(env.SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS).toBe(60);
    expect(env.SESSION_CLOCK_SKEW_SECONDS).toBe(30);
  });

  it("throws when APPLICATION_SESSION_SIGNING_KEY is missing", () => {
    expect(() =>
      getSessionEnvironment({
        APP_ENV: "local",
      }),
    ).toThrow("Invalid session environment: APPLICATION_SESSION_SIGNING_KEY");
  });

  it("throws when APPLICATION_SESSION_SIGNING_KEY is too short", () => {
    expect(() =>
      getSessionEnvironment({
        APP_ENV: "local",
        APPLICATION_SESSION_SIGNING_KEY: "too-short",
      }),
    ).toThrow("Invalid session environment: APPLICATION_SESSION_SIGNING_KEY");
  });
});
