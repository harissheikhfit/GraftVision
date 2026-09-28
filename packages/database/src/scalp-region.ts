import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const SCALP_REGION_CODES = [
  "frontal_recipient_region",
  "mid_scalp_region",
  "crown_region",
  "left_temporal_region",
  "right_temporal_region",
  "donor_rear_region",
  "donor_left_region",
  "donor_right_region",
  "exclusion_region",
] as const;

export type ScalpRegionCode = (typeof SCALP_REGION_CODES)[number];
export type ScalpRegionSourceKind = "model" | "image" | "manual";
export type ScalpRegionStatus = "draft" | "review";
export type ScalpRegionAuthoringMethod = "manual_draw" | "doctor_corrected";
export type ScalpRegionCoordinateFrame =
  | "graftvision-model-normalization-v1"
  | "graftvision-image-coordinate-v1"
  | "graftvision-manual-relative-v1";

export interface ScalpRegionBoundaryPoint {
  id: string;
  order_index: number;
  x: number;
  y: number;
  z: number;
}

export interface SaveScalpRegionInput {
  applicationSessionId: string;
  providerIdentityId: string;
  consultationId: string;
  regionId?: string;
  regionCode: ScalpRegionCode;
  sourceKind: ScalpRegionSourceKind;
  sourceReferenceId?: string;
  sourceRevision?: number;
  coordinateFrameVersion: ScalpRegionCoordinateFrame;
  authoringMethod: ScalpRegionAuthoringMethod;
  regionStatus: ScalpRegionStatus;
  boundaryPoints: ScalpRegionBoundaryPoint[];
  expectedRevision: number;
  idempotencyKey: string;
}

export interface SaveScalpRegionResult {
  regionId: string;
  regionVersionId: string;
  revision: number;
  isNew: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) throw new DatabaseBoundaryError(`${name} is invalid.`);
}

function validateInput(input: SaveScalpRegionInput): void {
  assertUuid(input.applicationSessionId, "applicationSessionId");
  assertUuid(input.providerIdentityId, "providerIdentityId");
  assertUuid(input.consultationId, "consultationId");
  if (input.regionId) assertUuid(input.regionId, "regionId");
  if (input.sourceReferenceId) assertUuid(input.sourceReferenceId, "sourceReferenceId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  if (
    input.sourceRevision !== undefined &&
    (!Number.isInteger(input.sourceRevision) || input.sourceRevision < 1)
  ) {
    throw new DatabaseBoundaryError("sourceRevision is invalid.");
  }
  if (input.boundaryPoints.length < 4 || input.boundaryPoints.length > 128) {
    throw new DatabaseBoundaryError("boundaryPoints are invalid.");
  }
  const orderIndexes = input.boundaryPoints.map((point) => point.order_index);
  const pointIds = input.boundaryPoints.map((point) => point.id);
  if (
    orderIndexes.some((orderIndex) => !Number.isInteger(orderIndex)) ||
    new Set(orderIndexes).size !== orderIndexes.length ||
    Math.min(...orderIndexes) !== 0 ||
    Math.max(...orderIndexes) !== orderIndexes.length - 1 ||
    pointIds.some((id) => !uuidPattern.test(id)) ||
    new Set(pointIds).size !== pointIds.length ||
    input.boundaryPoints.some(
      ({ x, y, z }) =>
        ![x, y, z].every(Number.isFinite) ||
        [x, y, z].some((coordinate) => coordinate < -2 || coordinate > 2),
    )
  ) {
    throw new DatabaseBoundaryError("boundaryPoints are invalid.");
  }
}

export async function saveScalpRegion(
  tx: TenantTransaction,
  input: SaveScalpRegionInput,
): Promise<SaveScalpRegionResult> {
  validateInput(input);
  const { rows } = await tx.query<{
    region_id: string;
    region_version_id: string;
    revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.save_scalp_region($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::uuid, $8::integer, $9::text, $10::text, $11::text, $12::jsonb, $13::integer, $14::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.regionId ?? null,
      input.regionCode,
      input.sourceKind,
      input.sourceReferenceId ?? null,
      input.sourceRevision ?? null,
      input.coordinateFrameVersion,
      input.authoringMethod,
      input.regionStatus,
      JSON.stringify(input.boundaryPoints),
      input.expectedRevision,
      input.idempotencyKey,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to save scalp region.");
  return {
    regionId: rows[0].region_id,
    regionVersionId: rows[0].region_version_id,
    revision: rows[0].revision,
    isNew: rows[0].is_new,
  };
}
