import { describe, expect, it } from "vitest";

import { isApprovedActivityEvent } from "./session-activity-boundary";

describe("shared-device activity policy", () => {
  it("accepts only trusted keyboard and pointer activity in a visible tab", () => {
    expect(isApprovedActivityEvent({ isTrusted: true, type: "keydown" }, "visible")).toBe(true);
    expect(isApprovedActivityEvent({ isTrusted: true, type: "pointerdown" }, "visible")).toBe(true);
  });

  it("excludes hidden, synthetic, polling, refresh, and generic background activity", () => {
    expect(isApprovedActivityEvent({ isTrusted: true, type: "keydown" }, "hidden")).toBe(false);
    expect(isApprovedActivityEvent({ isTrusted: false, type: "keydown" }, "visible")).toBe(false);
    expect(isApprovedActivityEvent({ isTrusted: true, type: "visibilitychange" }, "visible")).toBe(
      false,
    );
    expect(isApprovedActivityEvent({ isTrusted: true, type: "load" }, "visible")).toBe(false);
  });
});
