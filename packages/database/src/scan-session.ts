import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export type ScanSessionStatus = "created" | "paired" | "completed" | "expired" | "revoked";

export interface ScanSessionContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ScanSessionProjection {
  readonly id: string;
  readonly status: ScanSessionStatus;
  readonly revision: number;
  readonly isNew?: boolean;
}

export interface ScanSessionStatusProjection {
  readonly expiresAt: Date;
  readonly id: string;
  readonly revision: number;
  readonly status: ScanSessionStatus;
}

export const SCAN_CAPTURE_STEPS = [
  "preparation",
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
  "review",
  "capture_complete",
] as const;

export type ScanCaptureStep = (typeof SCAN_CAPTURE_STEPS)[number];
export type ScanCaptureAction = "complete" | "retake" | "review";

export interface ScanCaptureProjection {
  readonly captureStatus: "preparation" | "capturing" | "review" | "capture_complete";
  readonly completedAt: Date | null;
  readonly completedSteps: readonly string[];
  readonly currentStep: ScanCaptureStep;
  readonly lastActivityAt: Date;
  readonly retakeCounts: Readonly<Record<string, number>>;
  readonly revision: number;
  readonly startedAt: Date | null;
}

export function generateScanToken(): { rawToken: string } {
  const rawTokenBytes = randomBytes(32);
  const rawToken = rawTokenBytes.toString("base64url");
  return { rawToken };
}

export function hashScanToken(rawToken: string, secret: string): string {
  if (!secret) {
    throw new Error("Scan token hashing requires a secret key.");
  }
  return createHmac("sha256", secret).update(rawToken).digest("base64url");
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} is invalid.`);
  }
}

function assertContext(context: ScanSessionContext): void {
  assertUuid(context.applicationSessionId, "applicationSessionId");
  assertUuid(context.providerIdentityId, "providerIdentityId");
}

export async function createScanSession(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly id: string;
    readonly patientId: string;
    readonly consultationId: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
    readonly idempotencyKey: string;
  },
): Promise<ScanSessionProjection> {
  assertContext(input);
  assertUuid(input.id, "id");
  assertUuid(input.patientId, "patientId");
  assertUuid(input.consultationId, "consultationId");
  assertUuid(input.idempotencyKey, "idempotencyKey");

  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly revision: number;
    readonly is_new: boolean;
  }>(
    "select * from graftvision_private.create_scan_session($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::timestamptz,$8::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.id,
      input.patientId,
      input.consultationId,
      input.tokenHash,
      input.expiresAt,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan session creation failed.");
  return { id: row.scan_session_id, revision: row.revision, status: "created", isNew: row.is_new };
}

export async function pairScanSession(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly scanSessionId: string;
    readonly pairingNonce: string;
    readonly idempotencyKey: string;
  },
): Promise<ScanSessionProjection> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");

  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly revision: number;
    readonly status: string;
  }>(
    "select * from graftvision_private.pair_scan_session($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.pairingNonce,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan session pairing failed.");
  return {
    id: row.scan_session_id,
    revision: row.revision,
    status: row.status as ScanSessionStatus,
  };
}

export async function redeemScanSessionToken(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly tokenHash: string;
    readonly pairingNonce: string;
    readonly idempotencyKey: string;
  },
): Promise<ScanSessionProjection> {
  assertContext(input);
  assertUuid(input.idempotencyKey, "idempotencyKey");
  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly revision: number;
    readonly status: string;
  }>(
    "select * from graftvision_private.redeem_scan_session_token($1::uuid,$2::uuid,$3::text,$4::text,$5::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.tokenHash,
      input.pairingNonce,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan session pairing failed.");
  return {
    id: row.scan_session_id,
    revision: row.revision,
    status: row.status as ScanSessionStatus,
  };
}

export async function readScanSessionStatus(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly scanSessionId: string },
): Promise<ScanSessionStatusProjection | null> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly status: string;
    readonly revision: number;
    readonly expires_at: Date;
  }>("select * from graftvision_private.read_scan_session_status($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.scanSessionId,
  ]);
  const row = result.rows[0];
  return row
    ? {
        id: row.scan_session_id,
        status: row.status as ScanSessionStatus,
        revision: row.revision,
        expiresAt: row.expires_at,
      }
    : null;
}

export async function readScanCaptureState(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly scanSessionId: string },
): Promise<(ScanSessionStatusProjection & { readonly capture: ScanCaptureProjection }) | null> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly status: string;
    readonly revision: number;
    readonly expires_at: Date;
    readonly current_step: ScanCaptureStep;
    readonly completed_steps: readonly string[];
    readonly retake_counts: Readonly<Record<string, number>>;
    readonly capture_status: ScanCaptureProjection["captureStatus"];
    readonly started_at: Date | null;
    readonly last_activity_at: Date;
    readonly completed_at: Date | null;
    readonly capture_revision: number;
  }>("select * from graftvision_private.read_scan_capture_state($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.scanSessionId,
  ]);
  const row = result.rows[0];
  return row
    ? {
        capture: {
          captureStatus: row.capture_status,
          completedAt: row.completed_at,
          completedSteps: row.completed_steps,
          currentStep: row.current_step,
          lastActivityAt: row.last_activity_at,
          retakeCounts: row.retake_counts,
          revision: row.capture_revision,
          startedAt: row.started_at,
        },
        expiresAt: row.expires_at,
        id: row.scan_session_id,
        revision: row.revision,
        status: row.status as ScanSessionStatus,
      }
    : null;
}

export async function recordScanCaptureStep(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly action: ScanCaptureAction;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly scanSessionId: string;
    readonly step: Exclude<ScanCaptureStep, "capture_complete">;
  },
): Promise<ScanSessionStatusProjection & { readonly capture: ScanCaptureProjection }> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly status: string;
    readonly revision: number;
    readonly current_step: ScanCaptureStep;
    readonly completed_steps: readonly string[];
    readonly retake_counts: Readonly<Record<string, number>>;
    readonly capture_status: ScanCaptureProjection["captureStatus"];
    readonly capture_revision: number;
  }>(
    "select * from graftvision_private.record_scan_capture_step($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::integer,$7::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.step,
      input.action,
      input.expectedRevision,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan capture update failed.");
  const refreshed = await readScanCaptureState(transaction, input);
  if (!refreshed) throw new DatabaseBoundaryError("Scan capture state is unavailable.");
  return refreshed;
}

export async function registerScanCaptureAsset(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly assetId: string;
    readonly byteSize: number;
    readonly captureRevision: number;
    readonly checksum: string;
    readonly idempotencyKey: string;
    readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
    readonly objectKey: string;
    readonly scanSessionId: string;
    readonly step: string;
  },
): Promise<{ readonly assetId: string; readonly isNew: boolean }> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  const result = await transaction.query<{ readonly asset_id: string; readonly is_new: boolean }>(
    "select * from graftvision_private.register_scan_capture_asset($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::text,$9::integer,$10::text,$11::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.assetId,
      input.scanSessionId,
      input.step,
      input.captureRevision,
      input.objectKey,
      input.mimeType,
      input.byteSize,
      input.checksum,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan media upload failed.");
  return { assetId: row.asset_id, isNew: row.is_new };
}

/** Returns only a yes/no duplicate signal; the checksum never leaves the database boundary. */
export async function isDuplicateScanCaptureChecksum(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly assetId: string; readonly scanSessionId: string },
): Promise<boolean> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{ readonly is_duplicate: boolean }>(
    "select graftvision_private.is_duplicate_scan_capture_checksum($1::uuid,$2::uuid,$3::uuid,$4::uuid) as is_duplicate",
    [input.applicationSessionId, input.providerIdentityId, input.scanSessionId, input.assetId],
  );
  return result.rows[0]?.is_duplicate === true;
}

export async function assessScanTechnicalMetrics(
  transaction: TenantTransaction,
  input: {
    readonly blurVariance: number;
    readonly brightness: number;
    readonly duplicateChecksum: boolean;
    readonly framingCoverage: number;
    readonly height: number;
    readonly orientation: number;
    readonly width: number;
  },
): Promise<{ readonly qualityState: string; readonly reasonCode: string | null }> {
  const result = await transaction.query<{
    readonly quality_state: string;
    readonly reason_code: string | null;
  }>(
    "select * from graftvision_private.assess_scan_technical_metrics($1::integer,$2::integer,$3::numeric,$4::numeric,$5::numeric,$6::integer,$7::boolean)",
    [
      input.width,
      input.height,
      input.blurVariance,
      input.brightness,
      input.framingCoverage,
      input.orientation,
      input.duplicateChecksum,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan technical validation failed.");
  return { qualityState: row.quality_state, reasonCode: row.reason_code };
}

export async function authoriseScanCaptureUpload(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly assetId: string;
    readonly captureRevision: number;
    readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
    readonly scanSessionId: string;
    readonly step: string;
  },
): Promise<string> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{ readonly object_key: string }>(
    "select * from graftvision_private.authorise_scan_capture_upload($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.assetId,
      input.scanSessionId,
      input.step,
      input.captureRevision,
      input.mimeType,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan media authorization failed.");
  return row.object_key;
}

export async function readScanCapturePreview(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly assetId: string; readonly scanSessionId: string },
): Promise<{ readonly objectKey: string } | null> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{ readonly object_key: string }>(
    "select * from graftvision_private.read_scan_capture_preview($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.scanSessionId, input.assetId],
  );
  const row = result.rows[0];
  return row ? { objectKey: row.object_key } : null;
}

export async function saveScanQualityResult(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly assetId: string;
    readonly assetRevision: number;
    readonly captureStep: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly qualityState: string;
    readonly reasonCode: string | null;
    readonly scanSessionId: string;
    readonly validatorVersion: string;
  },
) {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  const result = await transaction.query<{
    readonly result_id: string;
    readonly revision: number;
    readonly is_new: boolean;
  }>(
    "select * from graftvision_private.save_scan_quality_result($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::text,$9::text,$10::integer,$11::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.assetId,
      input.captureStep,
      input.assetRevision,
      input.validatorVersion,
      input.qualityState,
      input.reasonCode,
      input.expectedRevision,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan quality save failed.");
  return { id: row.result_id, revision: row.revision, isNew: row.is_new };
}

export async function requestScanQualityRetake(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly assetId: string;
    readonly captureStep: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly reasonCode: string;
    readonly scanSessionId: string;
  },
): Promise<{ readonly id: string; readonly revision: number; readonly isNew: boolean }> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  assertUuid(input.idempotencyKey, "idempotencyKey");

  const result = await transaction.query<{
    readonly result_id: string;
    readonly revision: number;
    readonly is_new: boolean;
  }>(
    "select * from graftvision_private.request_scan_quality_retake($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.assetId,
      input.captureStep,
      input.expectedRevision,
      input.reasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan quality retake failed.");
  return { id: row.result_id, revision: row.revision, isNew: row.is_new };
}

export async function overrideScanQualityResult(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly assetId: string;
    readonly captureStep: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly overrideReasonCode: string;
    readonly scanSessionId: string;
  },
): Promise<{ readonly id: string; readonly revision: number; readonly isNew: boolean }> {
  assertContext(input);
  assertUuid(input.assetId, "assetId");
  assertUuid(input.scanSessionId, "scanSessionId");
  assertUuid(input.idempotencyKey, "idempotencyKey");

  const result = await transaction.query<{
    readonly result_id: string;
    readonly revision: number;
    readonly is_new: boolean;
  }>(
    "select * from graftvision_private.override_scan_quality_result($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.assetId,
      input.captureStep,
      input.expectedRevision,
      input.overrideReasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan quality override failed.");
  return { id: row.result_id, revision: row.revision, isNew: row.is_new };
}

export interface ScanQualityMatrixRow {
  readonly assetId: string | null;
  readonly captureStep: string;
  readonly doctorOverridden: boolean;
  readonly qualityResultId: string | null;
  readonly qualityRevision: number | null;
  readonly qualityState: string | null;
  readonly reasonCode: string | null;
  readonly retakeRequested: boolean;
  readonly stale: boolean;
  readonly validatedAt: Date | null;
  readonly validatorVersion: string | null;
}

export interface ScanPackageReadiness {
  readonly blockerCodes: readonly string[];
  readonly evaluatedAt: Date;
  readonly isReady: boolean;
  readonly qualityReviewRevision: number;
  readonly readyAngleCount: number;
  readonly requiredAngleCount: number;
}

export interface ScanAnalyzerHandoffProjection {
  readonly handoffId: string;
  readonly isNew: boolean;
  readonly qualityReviewRevision: number;
}

export interface ReconstructionJobProjection {
  readonly attemptCount: number;
  readonly cancellationEligible: boolean;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly failureCode: string | null;
  readonly id: string;
  readonly manifestId: string;
  readonly progressPercentage: number;
  readonly progressStage: string;
  readonly retryEligible: boolean;
  readonly revision: number;
  readonly startedAt: Date | null;
  readonly state: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface ReconstructionOutputStatus {
  readonly attemptCount: number;
  readonly boundingBoxMm: readonly number[] | null;
  readonly completedAt: Date | null;
  readonly coordinateSystemCode: string | null;
  readonly createdAt: Date;
  readonly engineVersion: string;
  readonly faceCount: number | null;
  readonly failureCode: string | null;
  readonly outputAvailable: boolean;
  readonly pointCount: number | null;
  readonly progressPercentage: number;
  readonly progressStage: string;
  readonly state: string;
  readonly unitCode: string | null;
  readonly vertexCount: number | null;
}

export async function readReconstructionOutputStatus(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly jobId: string },
): Promise<ReconstructionOutputStatus> {
  assertContext(input);
  assertUuid(input.jobId, "jobId");
  const result = await transaction.query<{
    readonly attempt_count: number;
    readonly bounding_box_mm: readonly number[] | null;
    readonly completed_at: Date | null;
    readonly coordinate_system_code: string | null;
    readonly created_at: Date;
    readonly engine_version: string;
    readonly face_count: number | null;
    readonly failure_code: string | null;
    readonly output_available: boolean;
    readonly point_count: number | null;
    readonly progress_percentage: number;
    readonly progress_stage: string;
    readonly state: string;
    readonly unit_code: string | null;
    readonly vertex_count: number | null;
  }>(
    "select * from graftvision_private.read_reconstruction_output_status($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.jobId],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Reconstruction output is unavailable.");
  return {
    attemptCount: row.attempt_count,
    boundingBoxMm: row.bounding_box_mm,
    completedAt: row.completed_at,
    coordinateSystemCode: row.coordinate_system_code,
    createdAt: row.created_at,
    engineVersion: row.engine_version,
    faceCount: row.face_count,
    failureCode: row.failure_code,
    outputAvailable: row.output_available,
    pointCount: row.point_count,
    progressPercentage: row.progress_percentage,
    progressStage: row.progress_stage,
    state: row.state,
    unitCode: row.unit_code,
    vertexCount: row.vertex_count,
  };
}

export async function createReconstructionJob(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly analyzerHandoffId: string;
    readonly expectedQualityReviewRevision: number;
    readonly idempotencyKey: string;
  },
): Promise<{
  readonly id: string;
  readonly isNew: boolean;
  readonly manifestId: string;
  readonly revision: number;
}> {
  assertContext(input);
  assertUuid(input.analyzerHandoffId, "analyzerHandoffId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  const result = await transaction.query<{
    readonly is_new: boolean;
    readonly job_id: string;
    readonly manifest_id: string;
    readonly revision: number;
  }>(
    "select * from graftvision_private.create_reconstruction_job($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.analyzerHandoffId,
      input.expectedQualityReviewRevision,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Reconstruction job creation failed.");
  return { id: row.job_id, isNew: row.is_new, manifestId: row.manifest_id, revision: row.revision };
}

export async function readReconstructionJobStatus(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly jobId: string },
): Promise<ReconstructionJobProjection> {
  assertContext(input);
  assertUuid(input.jobId, "jobId");
  const result = await transaction.query<{
    readonly attempt_count: number;
    readonly cancellation_eligible: boolean;
    readonly completed_at: Date | null;
    readonly created_at: Date;
    readonly failure_code: string | null;
    readonly job_id: string;
    readonly manifest_id: string;
    readonly progress_percentage: number;
    readonly progress_stage: string;
    readonly retry_eligible: boolean;
    readonly revision: number;
    readonly started_at: Date | null;
    readonly state: ReconstructionJobProjection["state"];
  }>(
    "select * from graftvision_private.read_reconstruction_job_status($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.jobId],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Reconstruction job status is unavailable.");
  return {
    attemptCount: row.attempt_count,
    cancellationEligible: row.cancellation_eligible,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    failureCode: row.failure_code,
    id: row.job_id,
    manifestId: row.manifest_id,
    progressPercentage: row.progress_percentage,
    progressStage: row.progress_stage,
    retryEligible: row.retry_eligible,
    revision: row.revision,
    startedAt: row.started_at,
    state: row.state,
  };
}

export async function createScanAnalyzerHandoff(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly expectedQualityReviewRevision: number;
    readonly idempotencyKey: string;
    readonly scanSessionId: string;
  },
): Promise<ScanAnalyzerHandoffProjection> {
  assertContext(input);
  assertUuid(input.idempotencyKey, "idempotencyKey");
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{
    readonly handoff_id: string;
    readonly is_new: boolean;
    readonly quality_review_revision: number;
  }>(
    "select * from graftvision_private.create_scan_analyzer_handoff($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.expectedQualityReviewRevision,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan analyzer handoff failed.");
  return {
    handoffId: row.handoff_id,
    isNew: row.is_new,
    qualityReviewRevision: row.quality_review_revision,
  };
}

export async function readScanQualityMatrix(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly scanSessionId: string },
): Promise<readonly ScanQualityMatrixRow[]> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{
    readonly asset_id: string | null;
    readonly capture_step: string;
    readonly doctor_overridden: boolean;
    readonly quality_result_id: string | null;
    readonly quality_revision: number | null;
    readonly quality_state: string | null;
    readonly reason_code: string | null;
    readonly retake_requested: boolean;
    readonly stale: boolean;
    readonly validated_at: Date | null;
    readonly validator_version: string | null;
  }>("select * from graftvision_private.read_scan_quality_matrix($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.scanSessionId,
  ]);
  return result.rows.map((row) => ({
    assetId: row.asset_id,
    captureStep: row.capture_step,
    doctorOverridden: row.doctor_overridden,
    qualityResultId: row.quality_result_id,
    qualityRevision: row.quality_revision,
    qualityState: row.quality_state,
    reasonCode: row.reason_code,
    retakeRequested: row.retake_requested,
    stale: row.stale,
    validatedAt: row.validated_at,
    validatorVersion: row.validator_version,
  }));
}

export async function readScanPackageReadiness(
  transaction: TenantTransaction,
  input: ScanSessionContext & { readonly scanSessionId: string },
): Promise<ScanPackageReadiness> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");
  const result = await transaction.query<{
    readonly blocker_codes: readonly string[];
    readonly evaluated_at: Date;
    readonly is_ready: boolean;
    readonly quality_review_revision: number;
    readonly ready_angle_count: number;
    readonly required_angle_count: number;
  }>("select * from graftvision_private.read_scan_package_readiness($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.scanSessionId,
  ]);
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan package readiness read failed.");
  return {
    blockerCodes: row.blocker_codes,
    evaluatedAt: row.evaluated_at,
    isReady: row.is_ready,
    qualityReviewRevision: row.quality_review_revision,
    readyAngleCount: row.ready_angle_count,
    requiredAngleCount: row.required_angle_count,
  };
}

export async function transitionScanSessionStatus(
  transaction: TenantTransaction,
  input: ScanSessionContext & {
    readonly scanSessionId: string;
    readonly newStatus: ScanSessionStatus;
    readonly reason: string | null;
    readonly idempotencyKey: string;
  },
): Promise<ScanSessionProjection> {
  assertContext(input);
  assertUuid(input.scanSessionId, "scanSessionId");

  const result = await transaction.query<{
    readonly scan_session_id: string;
    readonly revision: number;
    readonly status: string;
  }>(
    "select * from graftvision_private.transition_scan_session_status($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.newStatus,
      input.reason,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Scan session status transition failed.");
  return {
    id: row.scan_session_id,
    revision: row.revision,
    status: row.status as ScanSessionStatus,
  };
}
