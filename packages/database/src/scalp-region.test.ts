import { describe, expect, it, vi } from "vitest";

import { saveScalpRegion, type SaveScalpRegionInput } from "./scalp-region";

const input: SaveScalpRegionInput = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
  consultationId: "33333333-3333-4333-8333-333333333333",
  regionCode: "crown_region",
  sourceKind: "manual",
  coordinateFrameVersion: "graftvision-manual-relative-v1",
  authoringMethod: "manual_draw",
  regionStatus: "draft",
  boundaryPoints: [
    { id: "77777777-7777-4777-8777-777777777771", order_index: 0, x: 0, y: 0, z: 0 },
    { id: "77777777-7777-4777-8777-777777777772", order_index: 1, x: 1, y: 0, z: 0 },
    { id: "77777777-7777-4777-8777-777777777773", order_index: 2, x: 1, y: 1, z: 0 },
    { id: "77777777-7777-4777-8777-777777777774", order_index: 3, x: 0, y: 1, z: 0 },
  ],
  expectedRevision: 0,
  idempotencyKey: "44444444-4444-4444-8444-444444444444",
};

describe("scalp region boundary", () => {
  it("passes the bounded versioned save contract to PostgreSQL", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          region_id: "55555555-5555-4555-8555-555555555555",
          region_version_id: "66666666-6666-4666-8666-666666666666",
          revision: 1,
          is_new: true,
        },
      ],
    });

    await expect(saveScalpRegion({ query }, input)).resolves.toEqual({
      regionId: "55555555-5555-4555-8555-555555555555",
      regionVersionId: "66666666-6666-4666-8666-666666666666",
      revision: 1,
      isNew: true,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("save_scalp_region"), [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      null,
      input.regionCode,
      input.sourceKind,
      null,
      null,
      input.coordinateFrameVersion,
      input.authoringMethod,
      input.regionStatus,
      JSON.stringify(input.boundaryPoints),
      0,
      input.idempotencyKey,
    ]);
  });

  it("rejects invalid identifiers and geometry before querying PostgreSQL", async () => {
    const query = vi.fn();
    const transaction = { query };

    await expect(
      saveScalpRegion(transaction, { ...input, consultationId: "not-a-uuid" }),
    ).rejects.toThrow("consultationId is invalid.");
    await expect(saveScalpRegion(transaction, { ...input, boundaryPoints: [] })).rejects.toThrow(
      "boundaryPoints are invalid.",
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects revisions that violate the persisted contract before querying PostgreSQL", async () => {
    const query = vi.fn();
    const transaction = { query };

    await expect(saveScalpRegion(transaction, { ...input, expectedRevision: -1 })).rejects.toThrow(
      "expectedRevision is invalid.",
    );
    await expect(saveScalpRegion(transaction, { ...input, sourceRevision: 0 })).rejects.toThrow(
      "sourceRevision is invalid.",
    );
    await expect(saveScalpRegion(transaction, { ...input, sourceRevision: 1.5 })).rejects.toThrow(
      "sourceRevision is invalid.",
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects an empty database result instead of returning an incomplete contract", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(saveScalpRegion({ query }, input)).rejects.toThrow("Failed to save scalp region.");
  });
});
