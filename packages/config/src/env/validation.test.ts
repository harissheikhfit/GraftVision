import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateEnvironment } from "./validation";

describe("validateEnvironment", () => {
  it("returns a valid generic value", () => {
    const schema = z.object({
      FOUNDATION_TEST_VALUE: z.literal("valid"),
    });

    expect(
      validateEnvironment(schema, { FOUNDATION_TEST_VALUE: "valid" }, "foundation test"),
    ).toEqual({
      FOUNDATION_TEST_VALUE: "valid",
    });
  });

  it("reports a missing required variable with its name", () => {
    const schema = z.object({
      FOUNDATION_TEST_VALUE: z.string().min(1),
    });

    expect(() => validateEnvironment(schema, {}, "foundation test")).toThrowError(
      /Invalid foundation test environment: FOUNDATION_TEST_VALUE/,
    );
  });

  it("reports an invalid value with its name", () => {
    const schema = z.object({
      FOUNDATION_TEST_VALUE: z.literal("valid"),
    });

    expect(() =>
      validateEnvironment(schema, { FOUNDATION_TEST_VALUE: "invalid" }, "foundation test"),
    ).toThrowError(/Invalid foundation test environment: FOUNDATION_TEST_VALUE/);
  });

  it("does not include a malformed value in its error", () => {
    const schema = z.object({
      FOUNDATION_TEST_SECRET: z.literal("valid"),
    });
    const malformedValue = "synthetic-sensitive-value";

    expect(() =>
      validateEnvironment(schema, { FOUNDATION_TEST_SECRET: malformedValue }, "foundation test"),
    ).toThrowError(/FOUNDATION_TEST_SECRET/);

    try {
      validateEnvironment(schema, { FOUNDATION_TEST_SECRET: malformedValue }, "foundation test");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(malformedValue);
    }
  });
});
