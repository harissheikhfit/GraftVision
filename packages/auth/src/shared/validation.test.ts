import { describe, expect, it } from "vitest";

import { normaliseLoginInput, validateRedirectTarget } from "./validation";

describe("login validation", () => {
  it("normalises email without changing the password", () => {
    expect(normaliseLoginInput(" Owner.Alpha@Example.Test ", "Synthetic-Password-1!")).toEqual({
      input: {
        email: "owner.alpha@example.test",
        password: "Synthetic-Password-1!",
      },
      valid: true,
    });
  });

  it.each([
    [null, "Synthetic-Password-1!"],
    ["invalid", "Synthetic-Password-1!"],
    ["owner.alpha@example.test", "short"],
    ["owner.alpha@example.test", null],
  ])("rejects malformed credentials without returning their values", (email, password) => {
    expect(normaliseLoginInput(email, password)).toEqual({ valid: false });
  });

  it.each([
    undefined,
    null,
    "",
    "//evil.example.test",
    "https://evil.example.test",
    "%2F%2Fevil.example.test",
    "/platform",
    "/clinic?token=synthetic",
  ])("defaults unsafe redirect targets to the clinic route", (target) => {
    expect(validateRedirectTarget(target)).toBe("/clinic");
  });

  it("accepts only the approved internal clinic destination", () => {
    expect(validateRedirectTarget("/clinic")).toBe("/clinic");
  });
});
