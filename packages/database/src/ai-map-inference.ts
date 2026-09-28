import "server-only";

import type { AiMapProposalCurve, AiMapProposalLandmark, AiMapProposalRegion } from "./ai-map";

export type AiMapInferenceFailureCode =
  | "INITIALIZATION_FAILED"
  | "INVALID_INPUT"
  | "INFERENCE_FAILED"
  | "MODEL_NOT_FOUND"
  | "INSUFFICIENT_RESOURCES"
  | "TIMEOUT"
  | "CANCELLED";

export class AiMapInferenceError extends Error {
  constructor(
    public readonly code: AiMapInferenceFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "AiMapInferenceError";
  }
}

export interface AiMapInferenceOutput {
  readonly overallConfidence: number;
  readonly qualityState: "high" | "medium" | "low" | "insufficient";
  readonly landmarks: Omit<AiMapProposalLandmark, "id" | "proposal_package_id">[];
  readonly curves: Omit<AiMapProposalCurve, "id" | "proposal_package_id">[];
  readonly regions: Omit<AiMapProposalRegion, "id" | "proposal_package_id">[];
}

export interface AiMapInferenceContext {
  readonly onProgress?: (percentage: number, status: string) => void;
  readonly signal?: AbortSignal;
}

export interface AiMapInferenceConfig {
  readonly timeoutMs: number;
  readonly temporaryDirectoryRoot?: string;
}

export interface AiMapInferenceAdapter {
  readonly adapterName: string;
  readonly adapterVersion: string;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly inputPackageVersion: string;
  readonly inferencePipelineVersion: string;
  readonly supportedOutputs: readonly string[];

  initialize(config: AiMapInferenceConfig): Promise<void>;

  execute(
    input: {
      readonly workspace: string;
      readonly reconstructionArtifactPath: string;
    },
    context?: AiMapInferenceContext,
  ): Promise<AiMapInferenceOutput>;

  cleanup(): Promise<void>;
}
