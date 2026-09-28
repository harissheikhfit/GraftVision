import "server-only";

import {
  beginAiMapProposalExecution,
  failAiMapProposal,
  finalizeAiMapProposal,
  recordAiMapProposalOutput,
} from "./ai-map";
import {
  AiMapInferenceError,
  type AiMapInferenceAdapter,
  type AiMapInferenceOutput,
} from "./ai-map-inference";
import { OnnxAiMapInferenceAdapter } from "./onnx-ai-map-adapter";
import { DatabaseBoundaryError, type TenantTransaction } from "./server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface AiMapInferenceWorkerInput {
  readonly proposalId: string;
  readonly clinicId: string;
  readonly workerId: string;
  readonly reconstructionJobId: string;
  readonly reconstructionAttemptCount: number;
  readonly artifactPath: string;
  readonly artifactChecksum: string;
  readonly idempotencyKey: string;
  readonly workspace: string;
}

export interface AiMapInferenceWorkerResult {
  readonly executionId: string;
  readonly isNew: boolean;
  readonly output: AiMapInferenceOutput | null;
}

function requireUuid(value: string, label: string): void {
  if (!uuid.test(value)) throw new DatabaseBoundaryError(`${label} is invalid.`);
}

function validateOutput(output: AiMapInferenceOutput): void {
  if (
    !Number.isFinite(output.overallConfidence) ||
    output.overallConfidence < 0 ||
    output.overallConfidence > 1
  )
    throw new AiMapInferenceError("INFERENCE_FAILED", "Inference confidence is invalid.");
  const points = [
    ...output.landmarks.flatMap((landmark) => [landmark.normalized_coordinate]),
    ...output.curves.flatMap((curve) =>
      curve.control_points.map((point) => [point.x, point.y, point.z]),
    ),
    ...output.regions.flatMap((region) =>
      region.boundary_points.map((point) => [point.x, point.y, point.z]),
    ),
  ];
  if (
    points.some((point) =>
      point.some((value) => !Number.isFinite(value) || value < -2 || value > 2),
    )
  )
    throw new AiMapInferenceError("INFERENCE_FAILED", "Inference geometry is invalid.");
  if (
    [...output.landmarks, ...output.curves, ...output.regions].some(
      (entity) =>
        !Number.isFinite(entity.confidence) || entity.confidence < 0 || entity.confidence > 1,
    )
  )
    throw new AiMapInferenceError("INFERENCE_FAILED", "Inference entity confidence is invalid.");
}

export async function executeAiMapInferenceWorker(
  transaction: TenantTransaction,
  input: AiMapInferenceWorkerInput,
  adapter: AiMapInferenceAdapter = new OnnxAiMapInferenceAdapter(),
): Promise<AiMapInferenceWorkerResult> {
  [
    input.proposalId,
    input.clinicId,
    input.workerId,
    input.reconstructionJobId,
    input.idempotencyKey,
  ].forEach((value, index) => {
    requireUuid(
      value,
      ["proposalId", "clinicId", "workerId", "reconstructionJobId", "idempotencyKey"][index] ??
        "identifier",
    );
  });
  if (
    !Number.isSafeInteger(input.reconstructionAttemptCount) ||
    input.reconstructionAttemptCount < 1
  )
    throw new DatabaseBoundaryError("reconstructionAttemptCount is invalid.");
  if (!/^[A-Fa-f0-9]{64}$/u.test(input.artifactChecksum))
    throw new DatabaseBoundaryError("artifactChecksum is invalid.");

  let executionId: string | undefined;
  try {
    await transaction.query("select set_config('graftvision.reconstruction_worker','on',true)");
    const execution = await beginAiMapProposalExecution(transaction, {
      proposalId: input.proposalId,
      clinicId: input.clinicId,
      workerId: input.workerId,
      reconstructionJobId: input.reconstructionJobId,
      reconstructionAttemptCount: input.reconstructionAttemptCount,
      adapterName: adapter.adapterName,
      adapterVersion: adapter.adapterVersion,
      modelName: adapter.modelName,
      modelVersion: adapter.modelVersion,
      pipelineVersion: adapter.inferencePipelineVersion,
      artifactChecksum: input.artifactChecksum,
      idempotencyKey: input.idempotencyKey,
    });
    executionId = execution.executionId;
    if (!execution.isNew) return { executionId, isNew: false, output: null };

    await adapter.initialize({ timeoutMs: 120_000, temporaryDirectoryRoot: input.workspace });
    const output = await adapter.execute({
      workspace: input.workspace,
      reconstructionArtifactPath: input.artifactPath,
    });
    validateOutput(output);
    await recordAiMapProposalOutput(transaction, {
      executionId,
      landmarks: output.landmarks,
      curves: output.curves,
      regions: output.regions,
    });
    await finalizeAiMapProposal(transaction, {
      executionId,
      overallConfidence: output.overallConfidence,
      qualityState: output.qualityState,
    });
    return { executionId, isNew: true, output };
  } catch (error) {
    if (executionId) {
      await failAiMapProposal(transaction, { executionId, failureCode: "INFERENCE_FAILED" }).catch(
        () => {
          return undefined;
        },
      );
    }
    throw error;
  } finally {
    await adapter.cleanup().catch(() => {
      return undefined;
    });
  }
}
