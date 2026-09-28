import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const artifactTypes = new Set([
  "sparse_point_cloud",
  "dense_point_cloud",
  "surface_mesh",
  "reconstruction_preview",
  "bounded_metadata",
]);
const executionModes = new Set(["sparse_cpu", "dense_cuda"]);

export interface ReconstructionWorkerContext {
  readonly attemptCount: number;
  readonly configurationVersion: "recon-colmap-config-v2";
  readonly engineName: "COLMAP";
  readonly engineVersion: "4.1.1";
  readonly executionMode: "dense_cuda";
  readonly jobId: string;
  readonly preparedManifestId: string;
  readonly revision: number;
}
export interface WorkerPreparedAssetAccess {
  readonly captureStep: string;
  readonly checksum: string;
  readonly expiresAt: Date;
  readonly height: number;
  readonly objectReference: string;
  readonly preparedAssetId: string;
  readonly width: number;
}
export interface WorkerArtifactUploadAuthorization {
  readonly expiresAt: Date;
  readonly objectReference: string;
}
export interface WorkerArtifactResult {
  readonly artifactId: string;
  readonly isNew: boolean;
  readonly revision: number;
}

function requireUuid(value: string, label: string): void {
  if (!uuid.test(value)) throw new DatabaseBoundaryError(`${label} is invalid.`);
}
function requireWorker(jobId: string, workerId: string, attemptCount: number): void {
  requireUuid(jobId, "jobId");
  requireUuid(workerId, "workerId");
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1)
    throw new DatabaseBoundaryError("attemptCount is invalid.");
}

export async function readWorkerReconstructionContext(
  transaction: TenantTransaction,
  input: { jobId: string; workerId: string; attemptCount: number },
): Promise<ReconstructionWorkerContext> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  const row = (
    await transaction.query<{
      job_id: string;
      prepared_manifest_id: string;
      attempt_count: number;
      revision: number;
      execution_mode: "dense_cuda";
      engine_name: "COLMAP";
      engine_version: "4.1.1";
      configuration_version: "recon-colmap-config-v2";
    }>(
      "select * from graftvision_private.read_worker_reconstruction_context($1::uuid,$2::uuid,$3::integer)",
      [input.jobId, input.workerId, input.attemptCount],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Worker reconstruction context is unavailable.");
  return {
    attemptCount: row.attempt_count,
    configurationVersion: row.configuration_version,
    engineName: row.engine_name,
    engineVersion: row.engine_version,
    executionMode: row.execution_mode,
    jobId: row.job_id,
    preparedManifestId: row.prepared_manifest_id,
    revision: row.revision,
  };
}

export async function authorizePreparedAssetAccess(
  transaction: TenantTransaction,
  input: { jobId: string; workerId: string; attemptCount: number; preparedAssetId: string },
): Promise<WorkerPreparedAssetAccess> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  requireUuid(input.preparedAssetId, "preparedAssetId");
  const row = (
    await transaction.query<{
      prepared_asset_id: string;
      capture_step: string;
      object_reference: string;
      checksum: string;
      expires_at: Date;
      width: number;
      height: number;
    }>(
      "select * from graftvision_private.authorize_prepared_asset_access($1::uuid,$2::uuid,$3::integer,$4::uuid)",
      [input.jobId, input.workerId, input.attemptCount, input.preparedAssetId],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Prepared asset access is unavailable.");
  return {
    preparedAssetId: row.prepared_asset_id,
    captureStep: row.capture_step,
    objectReference: row.object_reference,
    checksum: row.checksum,
    expiresAt: row.expires_at,
    width: row.width,
    height: row.height,
  };
}

export async function authorizeWorkerReconstructionArtifactUpload(
  transaction: TenantTransaction,
  input: {
    jobId: string;
    workerId: string;
    attemptCount: number;
    artifactType: string;
    mimeType: string;
  },
): Promise<WorkerArtifactUploadAuthorization> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  if (!artifactTypes.has(input.artifactType))
    throw new DatabaseBoundaryError("artifactType is invalid.");
  const row = (
    await transaction.query<{ object_reference: string; expires_at: Date }>(
      "select * from graftvision_private.authorize_reconstruction_artifact_upload($1::uuid,$2::uuid,$3::integer,$4::text,$5::text)",
      [input.jobId, input.workerId, input.attemptCount, input.artifactType, input.mimeType],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Artifact upload authorization is unavailable.");
  return { objectReference: row.object_reference, expiresAt: row.expires_at };
}

export async function recordWorkerReconstructionArtifact(
  transaction: TenantTransaction,
  input: {
    jobId: string;
    workerId: string;
    attemptCount: number;
    expectedRevision: number;
    preparedManifestId: string;
    objectReference: string;
    artifactType: string;
    checksum: string;
    mimeType: string;
    byteSize: number;
    executionMode: string;
    idempotencyKey: string;
  },
): Promise<WorkerArtifactResult> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  [input.preparedManifestId, input.objectReference, input.idempotencyKey].forEach((value) => {
    requireUuid(value, "gateway identifier");
  });
  if (
    !artifactTypes.has(input.artifactType) ||
    !executionModes.has(input.executionMode) ||
    !/^[A-Fa-f0-9]{64}$/u.test(input.checksum) ||
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1
  )
    throw new DatabaseBoundaryError("Artifact input is invalid.");
  const row = (
    await transaction.query<{ artifact_id: string; revision: number; is_new: boolean }>(
      "select * from graftvision_private.record_worker_reconstruction_artifact($1::uuid,$2::uuid,$3::integer,$4::integer,$5::uuid,$6::uuid,$7::text,$8::text,$9::text,$10::integer,'COLMAP','4.1.1','recon-colmap-adapter-v2','recon-colmap-config-v2',$11::text,$12::uuid)",
      [
        input.jobId,
        input.workerId,
        input.attemptCount,
        input.expectedRevision,
        input.preparedManifestId,
        input.objectReference,
        input.artifactType,
        input.checksum,
        input.mimeType,
        input.byteSize,
        input.executionMode,
        input.idempotencyKey,
      ],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Artifact recording failed.");
  return { artifactId: row.artifact_id, revision: row.revision, isNew: row.is_new };
}

export async function finalizeWorkerReconstructionOutput(
  transaction: TenantTransaction,
  input: {
    jobId: string;
    workerId: string;
    attemptCount: number;
    expectedRevision: number;
    artifactId: string;
    pointCount: number;
    vertexCount: number;
    faceCount: number;
    boundingBoxMin: readonly [number, number, number];
    boundingBoxMax: readonly [number, number, number];
    sparseOrDense: "sparse" | "dense";
    idempotencyKey: string;
  },
): Promise<WorkerArtifactResult> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  [input.artifactId, input.idempotencyKey].forEach((value) => {
    requireUuid(value, "gateway identifier");
  });
  const row = (
    await transaction.query<{ output_manifest_id: string; revision: number; is_new: boolean }>(
      "select * from graftvision_private.finalize_real_reconstruction_output($1::uuid,$2::uuid,$3::integer,$4::integer,$5::uuid,$6::integer,$7::integer,$8::integer,$9::numeric[],$10::numeric[],$11::text,$12::uuid)",
      [
        input.jobId,
        input.workerId,
        input.attemptCount,
        input.expectedRevision,
        input.artifactId,
        input.pointCount,
        input.vertexCount,
        input.faceCount,
        input.boundingBoxMin,
        input.boundingBoxMax,
        input.sparseOrDense,
        input.idempotencyKey,
      ],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Output finalization failed.");
  return { artifactId: row.output_manifest_id, revision: row.revision, isNew: row.is_new };
}

export async function failWorkerReconstructionJob(
  transaction: TenantTransaction,
  input: { jobId: string; workerId: string; expectedRevision: number; failureCode: string },
): Promise<WorkerArtifactResult> {
  requireWorker(input.jobId, input.workerId, 1);
  const row = (
    await transaction.query<{ job_id: string; revision: number }>(
      "select * from graftvision_private.fail_reconstruction_job($1::uuid,$2::uuid,$3::integer,$4::text)",
      [input.jobId, input.workerId, input.expectedRevision, input.failureCode],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Worker failure recording failed.");
  return { artifactId: row.job_id, revision: row.revision, isNew: true };
}
export async function readWorkerCancellationState(
  transaction: TenantTransaction,
  input: { jobId: string; workerId: string; attemptCount: number },
): Promise<boolean> {
  requireWorker(input.jobId, input.workerId, input.attemptCount);
  const row = (
    await transaction.query<{ cancelled: boolean }>(
      "select * from graftvision_private.read_worker_cancellation_state($1::uuid,$2::uuid,$3::integer)",
      [input.jobId, input.workerId, input.attemptCount],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Cancellation state is unavailable.");
  return row.cancelled;
}
export async function renewWorkerHeartbeat(
  transaction: TenantTransaction,
  input: { jobId: string; workerId: string; expectedRevision: number },
): Promise<{ revision: number; leaseExpiresAt: Date }> {
  requireWorker(input.jobId, input.workerId, 1);
  const row = (
    await transaction.query<{ revision: number; lease_expires_at: Date }>(
      "select * from graftvision_private.renew_reconstruction_job_lease($1::uuid,$2::uuid,$3::integer)",
      [input.jobId, input.workerId, input.expectedRevision],
    )
  ).rows[0];
  if (!row) throw new DatabaseBoundaryError("Worker heartbeat failed.");
  return { revision: row.revision, leaseExpiresAt: row.lease_expires_at };
}
