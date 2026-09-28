import { describe, expect, it } from "vitest";

import {
  environmentBoolean,
  environmentInteger,
  environmentUrl,
  optionalEnvironmentBoolean,
  optionalEnvironmentString,
  requiredEnvironmentString,
} from "./parsers";

describe("environment parsers", () => {
  it("normalises empty optional strings without accepting empty required strings", () => {
    expect(optionalEnvironmentString.parse("   ")).toBeUndefined();
    expect(() => requiredEnvironmentString.parse("")).toThrowError();
    expect(requiredEnvironmentString.parse("synthetic-value")).toBe("synthetic-value");
  });

  it("parses only explicit boolean spellings", () => {
    expect(environmentBoolean.parse("true")).toBe(true);
    expect(environmentBoolean.parse("false")).toBe(false);
    expect(optionalEnvironmentBoolean.parse("")).toBeUndefined();
    expect(() => environmentBoolean.parse("1")).toThrowError(/true or false/);
  });

  it("parses safe base-10 integers without coercing malformed values", () => {
    expect(environmentInteger.parse("42")).toBe(42);
    expect(environmentInteger.parse("-7")).toBe(-7);
    expect(() => environmentInteger.parse("4.2")).toThrowError(/base-10 integer/);
    expect(() => environmentInteger.parse("9007199254740992")).toThrowError();
  });

  it("accepts absolute URLs and rejects empty or relative values", () => {
    expect(environmentUrl.parse("https://configuration.example.test/path")).toBe(
      "https://configuration.example.test/path",
    );
    expect(() => environmentUrl.parse("")).toThrowError(/valid absolute URL/);
    expect(() => environmentUrl.parse("/relative")).toThrowError(/valid absolute URL/);
  });
});
