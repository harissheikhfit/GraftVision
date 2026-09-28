import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export type LandmarkCode =
  | "glabella_reference"
  | "frontal_midline_reference"
  | "left_temporal_reference"
  | "right_temporal_reference"
  | "crown_center_reference"
  | "left_occipital_reference"
  | "right_occipital_reference"
  | "donor_center_reference"
  | "custom_technical_reference";

export type CurveCode =
  | "current_hairline"
  | "proposed_hairline"
  | "frontal_boundary"
  | "left_temporal_boundary"
  | "right_temporal_boundary"
  | "donor_upper_boundary"
  | "donor_lower_boundary"
  | "donor_left_boundary"
  | "donor_right_boundary"
  | "crown_boundary";

export type RegionCode =
  | "frontal_recipient_region"
  | "mid_scalp_region"
  | "crown_region"
  | "left_temporal_region"
  | "right_temporal_region"
  | "donor_rear_region"
  | "donor_left_region"
  | "donor_right_region"
  | "exclusion_region";

export type SmoothingMode = "linear" | "catmull_rom";

export interface CurveControlPoint {
  id: string;
  order_index: number;
  x: number;
  y: number;
  z: number;
}

export type LifecycleState = "active" | "tombstone";

export interface ActiveLandmarkValue {
  annotation_id: string;
  annotation_kind: "landmark";
  annotation_code: LandmarkCode;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  normalized_coordinate: [number, number, number];
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export interface InactiveLandmarkValue {
  annotation_id: string;
  annotation_kind: "landmark";
  annotation_code: LandmarkCode;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export interface ActiveCurveValue {
  annotation_id: string;
  annotation_kind: "curve";
  annotation_code: CurveCode;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  control_points: CurveControlPoint[];
  closed: boolean;
  smoothing_mode: SmoothingMode;
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export interface InactiveCurveValue {
  annotation_id: string;
  annotation_kind: "curve";
  annotation_code: CurveCode;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export interface ActiveRegionValue {
  annotation_id: string;
  annotation_kind: "region";
  annotation_code: string;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  boundary_points: CurveControlPoint[];
  closed: boolean;
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export interface InactiveRegionValue {
  annotation_id: string;
  annotation_kind: "region";
  annotation_code: string;
  lifecycle_state: LifecycleState;
  pointer_revision: number;
  version_revision: number;
  geometry_revision: number;
  created_at: string;
  updated_at: string;
}

export type ActiveAnnotationValue = ActiveLandmarkValue | ActiveCurveValue | ActiveRegionValue;
export type InactiveAnnotationValue =
  InactiveLandmarkValue | InactiveCurveValue | InactiveRegionValue;

export interface ModelAnnotationPackage {
  annotation_package_id: string;
  model_package_id: string;
  annotation_package_version: string;
  package_state: string;
  package_revision: number;
  geometry_revision: number;
  normalization_version: string;
  created_at: string;
  finalized_at: string | null;
  landmark_count: number;
  curve_count: number;
  region_count: number;
  active_annotations: ActiveAnnotationValue[];
  inactive_annotations: InactiveAnnotationValue[];
}

export interface ModelAnnotationEventValue {
  annotation_package_id: string;
  annotation_kind: string | null;
  annotation_code: string | null;
  lifecycle_state: LifecycleState;
  version_revision: number | null;
  superseded_version_id: string | null;
  event_type: string;
  created_at: string;
}

export async function readModelAnnotations(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
  },
): Promise<ModelAnnotationPackage> {
  const r = await t.query<ModelAnnotationPackage>(
    "select * from graftvision_private.read_model_annotations($1::uuid, $2::uuid, $3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.annotationPackageId],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Model annotations read failed.");
  return r.rows[0];
}

export async function saveModelLandmark(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    landmarkCode: LandmarkCode;
    x: number;
    y: number;
    z: number;
    surfaceReference: string | null;
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    landmark_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.save_model_landmark($1::uuid, $2::uuid, $3::uuid, $4::text, $5::numeric, $6::numeric, $7::numeric, $8::text, $9::integer, $10::integer, $11::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.landmarkCode,
      input.x,
      input.y,
      input.z,
      input.surfaceReference,
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to save model landmark.");
  return r.rows[0];
}

export async function supersedeModelLandmark(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    landmarkCode: LandmarkCode;
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    tombstone_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.supersede_model_landmark($1::uuid, $2::uuid, $3::uuid, $4::text, $5::integer, $6::integer, $7::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.landmarkCode,
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to supersede model landmark.");
  return r.rows[0];
}

export async function saveModelCurve(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    curveCode: CurveCode;
    points: CurveControlPoint[];
    closed: boolean;
    smoothingMode: SmoothingMode;
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    curve_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.save_model_curve($1::uuid, $2::uuid, $3::uuid, $4::text, $5::jsonb, $6::boolean, $7::text, $8::integer, $9::integer, $10::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.curveCode,
      JSON.stringify(input.points),
      input.closed,
      input.smoothingMode,
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to save model curve.");
  return r.rows[0];
}

export async function supersedeModelCurve(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    curveCode: CurveCode;
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    tombstone_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.supersede_model_curve($1::uuid, $2::uuid, $3::uuid, $4::text, $5::integer, $6::integer, $7::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.curveCode,
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to supersede model curve.");
  return r.rows[0];
}

export async function saveModelRegion(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    regionCode: RegionCode;
    points: CurveControlPoint[];
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    region_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.save_model_region($1::uuid, $2::uuid, $3::uuid, $4::text, $5::jsonb, $6::integer, $7::integer, $8::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.regionCode,
      JSON.stringify(input.points),
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to save model region.");
  return r.rows[0];
}

export async function supersedeModelRegion(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    regionCode: RegionCode;
    expectedPackageRevision: number;
    expectedPointerRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    tombstone_version_id: string;
    package_revision: number;
    pointer_revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.supersede_model_region($1::uuid, $2::uuid, $3::uuid, $4::text, $5::integer, $6::integer, $7::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.regionCode,
      input.expectedPackageRevision,
      input.expectedPointerRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to supersede model region.");
  return r.rows[0];
}

export async function finalizeModelAnnotations(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    expectedPackageRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    revision: number;
    is_new: boolean;
  }>(
    "select * from graftvision_private.finalize_model_annotation_package($1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.expectedPackageRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to finalize model annotations.");
  return r.rows[0];
}

export async function createSupersedingModelAnnotationDraft(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    expectedPackageRevision: number;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{
    draft_package_id: string;
    superseded_package_id: string;
    draft_package_state: string;
    superseded_package_state: string;
    revision: number;
    geometry_revision: number;
    landmark_count: number;
    curve_count: number;
    region_count: number;
    created_at: string;
    is_new: boolean;
  }>(
    "select * from graftvision_private.create_superseding_model_annotation_draft($1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.expectedPackageRevision,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Failed to create superseding draft.");
  return r.rows[0];
}

export async function readModelAnnotationHistory(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
  },
): Promise<ModelAnnotationEventValue[]> {
  const r = await t.query<ModelAnnotationEventValue>(
    "select * from graftvision_private.read_model_annotation_history($1::uuid, $2::uuid, $3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.annotationPackageId],
  );
  return r.rows;
}
