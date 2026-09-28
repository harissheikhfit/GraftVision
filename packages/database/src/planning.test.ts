/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { describe, expect, it, vi } from "vitest";

import {
  calculateAndUpsertPlanningPackage,
  finalizePlanningPackage,
  invalidatePlanningPackage,
  readPlanningPackage,
  type PlanningPackageInput,
} from "./planning";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
  clinicId: "33333333-3333-4333-8333-333333333333",
  consultationId: "44444444-4444-4444-8444-444444444444",
  annotationPackageId: "55555555-5555-4555-8555-555555555555",
  modelPackageId: "66666666-6666-4666-8666-666666666666",
  reconstructionOutputManifestId: "77777777-7777-4777-8777-777777777777",
  idempotencyKey: "88888888-8888-4888-8888-888888888888",
};

describe("planning foundation", () => {
  const baseInput: PlanningPackageInput = {
    ...context,
    geometryRevision: 1,
    densityProfileVersion: "balanced",
    donorReserveFactor: 0.2,
    crownWeighting: 0.8,
    temporalWeighting: 1.0,
    regions: [
      {
        code: "frontal_recipient_region",
        closed: true,
        boundaryPoints: [
          { id: "1", order_index: 0, x: 0, y: 0, z: 0 },
          { id: "2", order_index: 1, x: 1, y: 0, z: 0 },
          { id: "3", order_index: 2, x: 1, y: 1, z: 0 },
          { id: "4", order_index: 3, x: 0, y: 1, z: 0 },
          { id: "5", order_index: 4, x: -0.5, y: 0.5, z: 0 },
        ], // approx area 100
      },
      {
        code: "donor_rear_region",
        closed: true,
        boundaryPoints: [
          { id: "1", order_index: 0, x: 0, y: 0, z: 0 },
          { id: "2", order_index: 1, x: 2, y: 0, z: 0 },
          { id: "3", order_index: 2, x: 2, y: 2, z: 0 },
          { id: "4", order_index: 3, x: 0, y: 2, z: 0 },
          { id: "5", order_index: 4, x: -0.5, y: 0.5, z: 0 },
        ], // area > 100
      },
    ],
  };

  it("calculates planning metrics and saves a package", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { package_id: "99999999-9999-4999-8999-999999999999", package_revision: 1, is_new: true },
      ],
    });

    const result = await calculateAndUpsertPlanningPackage({ query }, baseInput);

    expect(result).toMatchObject({
      packageId: "99999999-9999-4999-8999-999999999999",
      revision: 1,
      isNew: true,
    });

    // Check parameters passed to DB
    const callArgs = query.mock.calls[0]![1];
    expect(callArgs[9]).toBe("balanced");
    expect(JSON.parse(callArgs[13])).toHaveProperty("frontal_recipient_region");
    expect(callArgs[18]).toBe("valid"); // geometry_validation_status
    expect(JSON.parse(callArgs[20])).toHaveProperty("frontal_recipient_region"); // target
    expect(callArgs[30]).toContain("PLAN_REQUIRES_DOCTOR_REVIEW"); // warnings
  });

  it("adds warnings for missing recipient or donor regions", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { package_id: "99999999-9999-4999-8999-999999999999", package_revision: 1, is_new: true },
      ],
    });

    const input = { ...baseInput, regions: [] };
    await calculateAndUpsertPlanningPackage({ query }, input);

    const callArgs = query.mock.calls[0]![1];
    const warnings = callArgs[30];
    expect(warnings).toContain("RECIPIENT_REGION_MISSING");
    expect(warnings).toContain("DONOR_REGION_MISSING");
  });

  it("reads a safe projection of the planning package", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          revision: 2,
          package_state: "calculated",
          density_profile_version: "conservative",
          donor_reserve_factor: 0.1,
          crown_weighting: 1.0,
          temporal_weighting: 1.0,
          geometry_validation_status: "valid",
          recipient_area_by_zone: { frontal_recipient_region: 100 },
          donor_area_by_zone: { donor_rear_region: 200 },
          total_recipient_area: 100,
          usable_donor_area: 200,
          estimated_grafts_target: { frontal_recipient_region: 3000 },
          total_grafts_min: 2700,
          total_grafts_target: 3000,
          total_grafts_max: 3300,
          donor_available_min: 12600,
          donor_available_max: 15400,
          donor_reserve: 1400,
          donor_utilization: 0.23,
          warnings: ["PLAN_REQUIRES_DOCTOR_REVIEW"],
        },
      ],
    });

    const result = await readPlanningPackage({ query }, context.consultationId);

    expect(result).toMatchObject({
      id: "99999999-9999-4999-8999-999999999999",
      revision: 2,
      packageState: "calculated",
      densityProfileVersion: "conservative",
      estimatedGraftsTarget: { frontal_recipient_region: 3000 },
    });
  });

  it("flags unsupported sparse geometry", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { package_id: "99999999-9999-4999-8999-999999999999", package_revision: 1, is_new: true },
      ],
    });

    const input = {
      ...baseInput,
      regions: [
        {
          code: "frontal_recipient_region" as const,
          closed: true,
          boundaryPoints: [
            { id: "1", order_index: 0, x: 0, y: 0, z: 0 },
            { id: "2", order_index: 1, x: 1, y: 0, z: 0 },
            { id: "3", order_index: 2, x: 1, y: 1, z: 0 },
          ], // only 3 points => sparse
        },
      ],
    };

    await calculateAndUpsertPlanningPackage({ query }, input);

    const callArgs = query.mock.calls[0]![1];
    expect(callArgs[18]).toBe("unsupported"); // validation status
    expect(callArgs[30]).toContain("SURFACE_AREA_UNAVAILABLE");
  });

  it("finalizes a calculated package through the controlled database function", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ revision: 2, is_new: true }],
    });

    await expect(
      finalizePlanningPackage(
        { query },
        {
          applicationSessionId: context.applicationSessionId,
          providerIdentityId: context.providerIdentityId,
          packageId: "99999999-9999-4999-8999-999999999999",
          expectedRevision: 1,
          idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      ),
    ).resolves.toEqual({ revision: 2, isNew: true });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("finalize_planning_package"), [
      context.applicationSessionId,
      context.providerIdentityId,
      "99999999-9999-4999-8999-999999999999",
      1,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
  });

  it("invalidates a package when an upstream geometry revision changes", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ revision: 3, is_new: true }] });

    await expect(
      invalidatePlanningPackage(
        { query },
        {
          applicationSessionId: context.applicationSessionId,
          providerIdentityId: context.providerIdentityId,
          packageId: "99999999-9999-4999-8999-999999999999",
          expectedRevision: 2,
          geometryRevision: 3,
          idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      ),
    ).resolves.toEqual({ revision: 3, isNew: true });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("invalidate_planning_package"), [
      context.applicationSessionId,
      context.providerIdentityId,
      "99999999-9999-4999-8999-999999999999",
      2,
      3,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
  });
});
