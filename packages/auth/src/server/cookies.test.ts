import { beforeEach, describe, expect, it, vi } from "vitest";

import { signSessionId, verifySessionId } from "./cookies";

interface MockSessionEnvironment {
  APPLICATION_SESSION_PREVIOUS_SIGNING_KEY: string | undefined;
  APPLICATION_SESSION_SIGNING_KEY: string;
  APP_ENV: "local";
  SESSION_ABSOLUTE_TIMEOUT_HOURS: number;
}

let mockEnv: MockSessionEnvironment;

vi.mock("@graftvision/config/env/session", () => ({
  getSessionEnvironment: vi.fn(() => mockEnv),
}));

describe("Session Cookies", () => {
  beforeEach(() => {
    mockEnv = {
      APPLICATION_SESSION_SIGNING_KEY: "01234567890123456789012345678901",
      APPLICATION_SESSION_PREVIOUS_SIGNING_KEY: undefined,
      APP_ENV: "local",
      SESSION_ABSOLUTE_TIMEOUT_HOURS: 12,
    };
  });

  it("signs and verifies a valid v1 session ID", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const signed = signSessionId(sessionId);

    expect(signed).toContain("v1.");
    expect(signed).toContain(sessionId);
    expect(signed.split(".")).toHaveLength(3);

    const verified = verifySessionId(signed);
    expect(verified).toBe(sessionId);
  });

  it("fails verification for tampered payload", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const signed = signSessionId(sessionId);

    const parts = signed.split(".");
    const tampered = `v1.22222222-2222-4222-8222-222222222222.${parts[2]}`;

    expect(verifySessionId(tampered)).toBeNull();
  });

  it("fails verification for tampered signature", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const signed = signSessionId(sessionId);

    const parts = signed.split(".");
    const tampered = `v1.${parts[1]}.${parts[2]?.substring(1)}`;

    expect(verifySessionId(tampered)).toBeNull();
  });

  it("fails verification for malformed cookie", () => {
    expect(verifySessionId("")).toBeNull();
    expect(verifySessionId("just-a-string")).toBeNull();
    expect(verifySessionId("part1.part2.part3.part4")).toBeNull();
  });

  it("fails verification for unknown version", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const signed = signSessionId(sessionId);
    const parts = signed.split(".");

    const v2Cookie = `v2.${parts[1]}.${parts[2]}`;
    expect(verifySessionId(v2Cookie)).toBeNull();
  });

  it("verifies with previous key during rotation but does not sign with it", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";

    // Setup environment with key A
    mockEnv.APPLICATION_SESSION_SIGNING_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const signedWithA = signSessionId(sessionId);
    expect(verifySessionId(signedWithA)).toBe(sessionId);

    // Rotate keys: B is new, A is previous
    mockEnv.APPLICATION_SESSION_SIGNING_KEY = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    mockEnv.APPLICATION_SESSION_PREVIOUS_SIGNING_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    // Cookie signed with A should still verify successfully
    expect(verifySessionId(signedWithA)).toBe(sessionId);

    // New cookies should be signed with B
    const signedWithB = signSessionId(sessionId);
    expect(signedWithB).not.toEqual(signedWithA);
    expect(verifySessionId(signedWithB)).toBe(sessionId);
  });

  it("previous-key removal invalidates old cookies", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    mockEnv.APPLICATION_SESSION_SIGNING_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const signedWithA = signSessionId(sessionId);

    // Completely new key, no previous key
    mockEnv.APPLICATION_SESSION_SIGNING_KEY = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
    mockEnv.APPLICATION_SESSION_PREVIOUS_SIGNING_KEY = undefined;

    expect(verifySessionId(signedWithA)).toBeNull();
  });
});
