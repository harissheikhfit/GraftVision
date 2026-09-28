import "server-only";

import path from "node:path";

export const CUDA_RECONSTRUCTION_ENGINE = "colmap" as const;
export const CUDA_RECONSTRUCTION_ENGINE_VERSION = "4.1.1" as const;
export const CUDA_RECONSTRUCTION_VERSION = "12.4" as const;
export const CUDA_RECONSTRUCTION_CONFIGURATION_VERSION = "recon-colmap-cuda-config-v1" as const;
export const CUDA_RECONSTRUCTION_ADAPTER_VERSION = "recon-colmap-cuda-adapter-v1" as const;

export const CUDA_RECONSTRUCTION_STAGES = [
  "loading_prepared_inputs",
  "feature_extraction",
  "feature_matching",
  "sparse_mapping",
  "image_undistortion",
  "dense_stereo",
  "stereo_fusion",
  "geometry_validation",
  "artifact_encoding",
  "finalizing_output",
  "completed",
] as const;

export type CudaReconstructionStage = (typeof CUDA_RECONSTRUCTION_STAGES)[number];
export type ReconstructionExecutionMode = "dense_cuda" | "sparse_only";

export interface ReconstructionWorkerCapability {
  readonly colmapVersion: typeof CUDA_RECONSTRUCTION_ENGINE_VERSION;
  readonly cudaVersion: typeof CUDA_RECONSTRUCTION_VERSION;
  readonly gpuModelCode: string;
  readonly supportsDense: boolean;
}

export interface ReconstructionWorkerClaim {
  readonly attempt: number;
  readonly executionMode: ReconstructionExecutionMode;
  readonly jobId: string;
  readonly leaseRevision: number;
  readonly workerId: string;
}

export interface PreparedReconstructionInputFile {
  readonly captureStep: string;
  readonly fileName: string;
}

export interface ReconstructionGeometry {
  readonly boundingBox: {
    readonly max: readonly [number, number, number];
    readonly min: readonly [number, number, number];
  };
  readonly byteSize: number;
  readonly checksum: string;
  readonly pointCount: number;
}

export interface CudaWorkerGateway {
  claim(capability: ReconstructionWorkerCapability): Promise<ReconstructionWorkerClaim | null>;
  ensureLease(claim: ReconstructionWorkerClaim): Promise<void>;
  isCancelled(claim: ReconstructionWorkerClaim): Promise<boolean>;
  materializePreparedInputs(
    claim: ReconstructionWorkerClaim,
    directory: string,
  ): Promise<readonly PreparedReconstructionInputFile[]>;
  publishProgress(claim: ReconstructionWorkerClaim, stage: CudaReconstructionStage): Promise<void>;
  validateDenseArtifact(
    claim: ReconstructionWorkerClaim,
    artifactPath: string,
  ): Promise<ReconstructionGeometry>;
  publishDenseArtifact(
    claim: ReconstructionWorkerClaim,
    artifactPath: string,
    geometry: ReconstructionGeometry,
  ): Promise<void>;
  finalize(claim: ReconstructionWorkerClaim): Promise<void>;
  fail(claim: ReconstructionWorkerClaim, code: CudaWorkerFailureCode): Promise<void>;
}

export interface CudaProcessRunner {
  run(
    command: readonly string[],
    options: { readonly cwd: string; readonly timeoutMs: number },
  ): Promise<void>;
}

export type CudaWorkerFailureCode =
  | "CUDA_UNAVAILABLE"
  | "CUDA_VERSION_MISMATCH"
  | "COLMAP_VERSION_MISMATCH"
  | "DENSE_STEREO_FAILED"
  | "FUSION_FAILED"
  | "JOB_CANCELLED"
  | "LEASE_DENIED"
  | "OUTPUT_INVALID";

export class CudaReconstructionWorkerError extends Error {
  constructor(
    readonly code: CudaWorkerFailureCode,
    message: string,
  ) {
    super(message);
  }
}

function inside(workspace: string, target: string): string {
  const root = path.resolve(workspace);
  const candidate = path.resolve(target);
  if (
    path.relative(root, candidate).startsWith("..") ||
    path.isAbsolute(path.relative(root, candidate))
  )
    throw new CudaReconstructionWorkerError(
      "OUTPUT_INVALID",
      "Worker path escapes its bounded workspace.",
    );
  return candidate;
}

function assertCapability(capability: ReconstructionWorkerCapability): void {
  if (!capability.supportsDense)
    throw new CudaReconstructionWorkerError("CUDA_UNAVAILABLE", "Dense CUDA is unavailable.");
  if (capability.cudaVersion !== CUDA_RECONSTRUCTION_VERSION)
    throw new CudaReconstructionWorkerError(
      "CUDA_VERSION_MISMATCH",
      "CUDA version is not approved.",
    );
  if (capability.colmapVersion !== CUDA_RECONSTRUCTION_ENGINE_VERSION)
    throw new CudaReconstructionWorkerError(
      "COLMAP_VERSION_MISMATCH",
      "COLMAP version is not approved.",
    );
  if (!/^[A-Z0-9_-]{1,64}$/u.test(capability.gpuModelCode))
    throw new CudaReconstructionWorkerError("CUDA_UNAVAILABLE", "GPU capability is invalid.");
}

export function buildCudaColmapPipeline(
  workspace: string,
  imageDirectory: string,
): readonly (readonly string[])[] {
  const safeWorkspace = inside(workspace, workspace);
  const safeImages = inside(safeWorkspace, imageDirectory);
  const database = path.join(safeWorkspace, "database.db");
  const sparse = path.join(safeWorkspace, "sparse");
  const dense = path.join(safeWorkspace, "dense");
  return [
    ["feature_extractor", "--database_path", database, "--image_path", safeImages],
    ["exhaustive_matcher", "--database_path", database],
    ["mapper", "--database_path", database, "--image_path", safeImages, "--output_path", sparse],
    [
      "image_undistorter",
      "--image_path",
      safeImages,
      "--input_path",
      path.join(sparse, "0"),
      "--output_path",
      dense,
      "--output_type",
      "COLMAP",
    ],
    ["patch_match_stereo", "--workspace_path", dense, "--workspace_format", "COLMAP"],
    [
      "stereo_fusion",
      "--workspace_path",
      dense,
      "--workspace_format",
      "COLMAP",
      "--output_path",
      path.join(dense, "fused.ply"),
    ],
  ];
}

export async function runCudaReconstructionWorker(input: {
  readonly capability: ReconstructionWorkerCapability;
  readonly gateway: CudaWorkerGateway;
  readonly runner: CudaProcessRunner;
  readonly timeoutMs: number;
  readonly workspace: string;
}): Promise<"idle" | "completed"> {
  assertCapability(input.capability);
  const claim = await input.gateway.claim(input.capability);
  if (!claim) return "idle";
  if (claim.executionMode !== "dense_cuda") {
    await input.gateway.fail(claim, "CUDA_UNAVAILABLE");
    return "completed";
  }
  try {
    const imageDirectory = inside(input.workspace, path.join(input.workspace, "inputs"));
    await input.gateway.ensureLease(claim);
    if (await input.gateway.isCancelled(claim))
      throw new CudaReconstructionWorkerError("JOB_CANCELLED", "Job cancelled.");
    await input.gateway.publishProgress(claim, "loading_prepared_inputs");
    const inputs = await input.gateway.materializePreparedInputs(claim, imageDirectory);
    if (inputs.length !== 7)
      throw new CudaReconstructionWorkerError("OUTPUT_INVALID", "Prepared input count is invalid.");
    const commands = buildCudaColmapPipeline(input.workspace, imageDirectory);
    const stages: readonly CudaReconstructionStage[] = [
      "feature_extraction",
      "feature_matching",
      "sparse_mapping",
      "image_undistortion",
      "dense_stereo",
      "stereo_fusion",
    ];
    for (const [index, command] of commands.entries()) {
      const stage = stages[index];
      if (!stage)
        throw new CudaReconstructionWorkerError("OUTPUT_INVALID", "Pipeline stage is invalid.");
      await input.gateway.ensureLease(claim);
      if (await input.gateway.isCancelled(claim))
        throw new CudaReconstructionWorkerError("JOB_CANCELLED", "Job cancelled.");
      await input.gateway.publishProgress(claim, stage);
      try {
        await input.runner.run(command, { cwd: input.workspace, timeoutMs: input.timeoutMs });
      } catch {
        throw new CudaReconstructionWorkerError(
          index === commands.length - 1
            ? "FUSION_FAILED"
            : index === commands.length - 2
              ? "DENSE_STEREO_FAILED"
              : "OUTPUT_INVALID",
          "COLMAP stage failed.",
        );
      }
    }
    await input.gateway.ensureLease(claim);
    await input.gateway.publishProgress(claim, "geometry_validation");
    const artifactPath = inside(input.workspace, path.join(input.workspace, "dense", "fused.ply"));
    const geometry = await input.gateway.validateDenseArtifact(claim, artifactPath);
    if (
      geometry.byteSize < 1 ||
      !/^[a-f0-9]{64}$/iu.test(geometry.checksum) ||
      geometry.pointCount < 1 ||
      [...geometry.boundingBox.min, ...geometry.boundingBox.max].some(
        (value) => !Number.isFinite(value),
      )
    )
      throw new CudaReconstructionWorkerError(
        "OUTPUT_INVALID",
        "Dense artifact validation failed.",
      );
    await input.gateway.publishProgress(claim, "artifact_encoding");
    await input.gateway.publishDenseArtifact(claim, artifactPath, geometry);
    await input.gateway.publishProgress(claim, "finalizing_output");
    await input.gateway.finalize(claim);
    await input.gateway.publishProgress(claim, "completed");
    return "completed";
  } catch (error) {
    const code = error instanceof CudaReconstructionWorkerError ? error.code : "OUTPUT_INVALID";
    await input.gateway.fail(claim, code);
    return "completed";
  }
}
