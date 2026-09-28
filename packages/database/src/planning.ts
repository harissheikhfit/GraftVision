import "server-only";

import { type CurveControlPoint, type RegionCode } from "./model-annotation";
import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export type DensityProfileVersion = "conservative" | "balanced" | "dense";
export type PackageState = "draft" | "calculated" | "finalized" | "superseded" | "stale";
export type GeometryValidationStatus = "valid" | "invalid" | "stale" | "unsupported";

export interface PlanningWarning {
  code: string;
}

export const PLANNING_WARNING_CODES = [
  "RECIPIENT_REGION_MISSING",
  "DONOR_REGION_MISSING",
  "EXCLUSION_REGION_OVERLAP",
  "DONOR_CAPACITY_INSUFFICIENT",
  "DENSITY_TARGET_OUT_OF_RANGE",
  "GEOMETRY_STALE",
  "SURFACE_AREA_UNAVAILABLE",
  "RECIPIENT_AREA_TOO_LARGE",
  "DONOR_RESERVE_TOO_LOW",
  "PLAN_REQUIRES_DOCTOR_REVIEW",
] as const;

export type PlanningWarningCode = (typeof PLANNING_WARNING_CODES)[number];

export interface PlanningPackageInput {
  applicationSessionId: string;
  providerIdentityId: string;
  clinicId: string;
  consultationId: string;
  annotationPackageId: string;
  modelPackageId: string;
  reconstructionOutputManifestId: string;
  aiProposalId?: string;
  geometryRevision: number;
  densityProfileVersion: DensityProfileVersion;
  donorReserveFactor: number;
  crownWeighting: number;
  temporalWeighting: number;
  idempotencyKey: string;
  regions: Array<{
    code: RegionCode;
    boundaryPoints: CurveControlPoint[];
    closed: boolean;
  }>;
}

export interface PlanningPackageResult {
  packageId: string;
  revision: number;
  isNew: boolean;
}

// 3D Polygon area approximation
function calculatePolygonArea(points: CurveControlPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  // A simplistic planar projection area for proof-of-concept
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    if (!p1 || !p2) continue;
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2.0);
}

export async function calculateAndUpsertPlanningPackage(
  tx: TenantTransaction,
  input: PlanningPackageInput,
): Promise<PlanningPackageResult> {
  const recipientAreaByZone: Record<string, number> = {};
  const donorAreaByZone: Record<string, number> = {};
  let exclusionArea = 0;
  let totalRecipientArea = 0;
  let geometryValidationStatus: GeometryValidationStatus = "valid";
  const warnings: PlanningWarningCode[] = [];

  let hasRecipient = false;
  let hasDonor = false;

  const validBounds = (p: CurveControlPoint) =>
    p.x >= -2.0 && p.x <= 2.0 && p.y >= -2.0 && p.y <= 2.0 && p.z >= -2.0 && p.z <= 2.0;

  for (const region of input.regions) {
    if (!region.closed) {
      geometryValidationStatus = "invalid";
    }
    if (region.boundaryPoints.some((p) => !validBounds(p))) {
      geometryValidationStatus = "invalid";
    }

    // simplistic self-inconsistent ordering check (just checking for at least 3 points)
    if (region.boundaryPoints.length < 3) {
      geometryValidationStatus = "invalid";
    }

    // "unsupported sparse-only geometry"
    if (region.boundaryPoints.length < 5) {
      geometryValidationStatus = "unsupported";
      warnings.push("SURFACE_AREA_UNAVAILABLE");
    }

    const area = calculatePolygonArea(region.boundaryPoints) * 100; // cm2 scaled
    if (
      [
        "frontal_recipient_region",
        "mid_scalp_region",
        "crown_region",
        "left_temporal_region",
        "right_temporal_region",
      ].includes(region.code)
    ) {
      recipientAreaByZone[region.code] = area;
      totalRecipientArea += area;
      hasRecipient = true;
    } else if (
      ["donor_rear_region", "donor_left_region", "donor_right_region"].includes(region.code)
    ) {
      donorAreaByZone[region.code] = area;
      hasDonor = true;
    } else if (region.code === "exclusion_region") {
      exclusionArea = area;
    }
  }

  if (!hasRecipient) warnings.push("RECIPIENT_REGION_MISSING");
  if (!hasDonor) warnings.push("DONOR_REGION_MISSING");

  if (exclusionArea > 0 && totalRecipientArea > 0) {
    warnings.push("EXCLUSION_REGION_OVERLAP"); // simplistic representation
  }

  const usableDonorArea = Object.values(donorAreaByZone).reduce((a, b) => a + b, 0);

  // Density profile defaults
  let densityTarget = 0;
  if (input.densityProfileVersion === "conservative") densityTarget = 30;
  else if (input.densityProfileVersion === "balanced") densityTarget = 40;
  else if (input.densityProfileVersion === "dense") densityTarget = 50;

  if (densityTarget < 20 || densityTarget > 60) {
    warnings.push("DENSITY_TARGET_OUT_OF_RANGE");
  }

  const estMin: Record<string, number> = {};
  const estTarget: Record<string, number> = {};
  const estMax: Record<string, number> = {};
  let totalMin = 0;
  let totalTarget = 0;
  let totalMax = 0;

  for (const [zone, area] of Object.entries(recipientAreaByZone)) {
    let zoneDensity = densityTarget;
    if (zone === "crown_region") zoneDensity *= input.crownWeighting;
    if (zone.includes("temporal")) zoneDensity *= input.temporalWeighting;

    const target = Math.round(area * zoneDensity);
    estMin[zone] = Math.round(target * 0.9);
    estTarget[zone] = target;
    estMax[zone] = Math.round(target * 1.1);

    totalMin += estMin[zone] ?? 0;
    totalTarget += estTarget[zone] ?? 0;
    totalMax += estMax[zone] ?? 0;
  }

  const donorAvailableTarget = Math.round(usableDonorArea * 70); // Assume 70 FUs per cm2 in donor
  const donorAvailableMin = Math.round(donorAvailableTarget * 0.9);
  const donorAvailableMax = Math.round(donorAvailableTarget * 1.1);

  const donorReserve = Math.round(donorAvailableTarget * input.donorReserveFactor);
  const usableCapacity = donorAvailableTarget - donorReserve;

  let donorUtilization = 0;
  if (usableCapacity > 0) {
    donorUtilization = totalTarget / usableCapacity;
  }

  if (donorUtilization > 1.0) {
    warnings.push("DONOR_CAPACITY_INSUFFICIENT");
  }

  if (totalRecipientArea > 200) {
    warnings.push("RECIPIENT_AREA_TOO_LARGE");
  }

  if (input.donorReserveFactor < 0.1) {
    warnings.push("DONOR_RESERVE_TOO_LOW");
  }

  warnings.push("PLAN_REQUIRES_DOCTOR_REVIEW");

  const dedupedWarnings = Array.from(new Set(warnings));

  const payloadHashStr = JSON.stringify({
    geom: input.geometryRevision,
    prof: input.densityProfileVersion,
    dr: input.donorReserveFactor,
    cw: input.crownWeighting,
    tw: input.temporalWeighting,
    regions: input.regions.map((r) => r.code).sort(),
  });

  // Pseudo-hash for idempotency payload
  let hashNum = 0;
  for (let i = 0; i < payloadHashStr.length; i++)
    hashNum = (Math.imul(31, hashNum) + payloadHashStr.charCodeAt(i)) | 0;
  const payloadHash = hashNum.toString(16).padStart(64, "0");

  const { rows } = await tx.query<{
    package_id: string;
    package_revision: number;
    is_new: boolean;
  }>(
    `select package_id, package_revision, is_new from graftvision_private.upsert_planning_package(
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::integer, $10::text, $11::numeric, $12::numeric, $13::numeric, $14::jsonb, $15::jsonb, $16::numeric, $17::numeric, $18::numeric, $19::text, $20::jsonb, $21::jsonb, $22::jsonb, $23::integer, $24::integer, $25::integer, $26::integer, $27::integer, $28::integer, $29::numeric, $30::numeric, $31::text[], $32::uuid, $33::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.clinicId,
      input.consultationId,
      input.annotationPackageId,
      input.modelPackageId,
      input.reconstructionOutputManifestId,
      input.aiProposalId || null,
      input.geometryRevision,
      input.densityProfileVersion,
      input.donorReserveFactor,
      input.crownWeighting,
      input.temporalWeighting,
      JSON.stringify(recipientAreaByZone),
      JSON.stringify(donorAreaByZone),
      exclusionArea,
      usableDonorArea,
      totalRecipientArea,
      geometryValidationStatus,
      JSON.stringify(estMin),
      JSON.stringify(estTarget),
      JSON.stringify(estMax),
      totalMin,
      totalTarget,
      totalMax,
      donorAvailableMin,
      donorAvailableMax,
      donorReserve,
      donorUtilization,
      totalTarget > 0 ? 100.0 : 0, // Coverage percentage simplification
      dedupedWarnings,
      input.idempotencyKey,
      payloadHash,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to upsert planning package.");

  return {
    packageId: rows[0].package_id,
    revision: rows[0].package_revision,
    isNew: rows[0].is_new,
  };
}

export interface PlanningSafeReadProjection {
  id: string;
  revision: number;
  packageState: PackageState;
  densityProfileVersion: DensityProfileVersion;
  donorReserveFactor: number;
  crownWeighting: number;
  temporalWeighting: number;
  geometryValidationStatus: GeometryValidationStatus;
  recipientAreaByZone: Record<string, number>;
  donorAreaByZone: Record<string, number>;
  totalRecipientArea: number;
  usableDonorArea: number;
  estimatedGraftsTarget: Record<string, number>;
  totalGraftsMin: number;
  totalGraftsTarget: number;
  totalGraftsMax: number;
  donorAvailableMin: number;
  donorAvailableMax: number;
  donorReserve: number;
  donorUtilization: number;
  warnings: string[];
}

export async function readPlanningPackage(
  tx: TenantTransaction,
  consultationId: string,
): Promise<PlanningSafeReadProjection | null> {
  const { rows } = await tx.query<{
    id: string;
    revision: number;
    package_state: PackageState;
    density_profile_version: DensityProfileVersion;
    donor_reserve_factor: number;
    crown_weighting: number;
    temporal_weighting: number;
    geometry_validation_status: GeometryValidationStatus;
    recipient_area_by_zone: Record<string, number>;
    donor_area_by_zone: Record<string, number>;
    total_recipient_area: number;
    usable_donor_area: number;
    estimated_grafts_target: Record<string, number>;
    total_grafts_min: number;
    total_grafts_target: number;
    total_grafts_max: number;
    donor_available_min: number;
    donor_available_max: number;
    donor_reserve: number;
    donor_utilization: number;
    warnings: string[];
  }>(
    `select id, revision, package_state, density_profile_version, donor_reserve_factor, crown_weighting, temporal_weighting, geometry_validation_status, recipient_area_by_zone, donor_area_by_zone, total_recipient_area, usable_donor_area, estimated_grafts_target, total_grafts_min, total_grafts_target, total_grafts_max, donor_available_min, donor_available_max, donor_reserve, donor_utilization, warnings
     from public.planning_package
     where consultation_id = $1
     order by revision desc limit 1`,
    [consultationId],
  );

  if (!rows[0]) return null;

  return {
    id: rows[0].id,
    revision: rows[0].revision,
    packageState: rows[0].package_state,
    densityProfileVersion: rows[0].density_profile_version,
    donorReserveFactor: rows[0].donor_reserve_factor,
    crownWeighting: rows[0].crown_weighting,
    temporalWeighting: rows[0].temporal_weighting,
    geometryValidationStatus: rows[0].geometry_validation_status,
    recipientAreaByZone: rows[0].recipient_area_by_zone,
    donorAreaByZone: rows[0].donor_area_by_zone,
    totalRecipientArea: rows[0].total_recipient_area,
    usableDonorArea: rows[0].usable_donor_area,
    estimatedGraftsTarget: rows[0].estimated_grafts_target,
    totalGraftsMin: rows[0].total_grafts_min,
    totalGraftsTarget: rows[0].total_grafts_target,
    totalGraftsMax: rows[0].total_grafts_max,
    donorAvailableMin: rows[0].donor_available_min,
    donorAvailableMax: rows[0].donor_available_max,
    donorReserve: rows[0].donor_reserve,
    donorUtilization: rows[0].donor_utilization,
    warnings: rows[0].warnings,
  };
}

export async function finalizePlanningPackage(
  tx: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    packageId: string;
    expectedRevision: number;
    idempotencyKey: string;
  },
): Promise<{ revision: number; isNew: boolean }> {
  const { rows } = await tx.query<{ revision: number; is_new: boolean }>(
    `select revision, is_new from graftvision_private.finalize_planning_package(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.packageId,
      input.expectedRevision,
      input.idempotencyKey,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to finalize planning package.");
  return { revision: rows[0].revision, isNew: rows[0].is_new };
}

export async function invalidatePlanningPackage(
  tx: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    packageId: string;
    expectedRevision: number;
    geometryRevision: number;
    idempotencyKey: string;
  },
): Promise<{ revision: number; isNew: boolean }> {
  const { rows } = await tx.query<{ revision: number; is_new: boolean }>(
    `select revision, is_new from graftvision_private.invalidate_planning_package(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::integer, $6::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.packageId,
      input.expectedRevision,
      input.geometryRevision,
      input.idempotencyKey,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to invalidate planning package.");
  return { revision: rows[0].revision, isNew: rows[0].is_new };
}
