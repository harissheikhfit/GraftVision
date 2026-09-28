import { describe, expect, it } from "vitest";

import { executeSyntheticReconstruction } from "./reconstruction-engine";

const inputs = [
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
].map((captureStep, index) => ({ captureStep, normalizedChecksum: String(index).repeat(64) }));

describe("executeSyntheticReconstruction", () => {
  it("emits the same non-clinical GLB envelope for the same prepared inputs", () => {
    const first = executeSyntheticReconstruction(inputs);
    const second = executeSyntheticReconstruction([...inputs].reverse());
    expect(first.checksum).toBe(second.checksum);
    expect(Buffer.from(first.bytes).subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(first.engineName).toBe("recon-engine-synthetic-v1");
  });
});
