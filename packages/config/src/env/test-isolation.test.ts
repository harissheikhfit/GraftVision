import { describe, expect, it } from "vitest";

describe("unit-test isolation", () => {
  it("blocks unexpected network access", async () => {
    await expect(fetch("https://network.example.test")).rejects.toThrowError(
      /Network access is disabled in unit tests/,
    );
  });
});
