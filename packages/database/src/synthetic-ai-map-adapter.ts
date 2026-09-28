import "server-only";

import type {
  AiMapInferenceAdapter,
  AiMapInferenceConfig,
  AiMapInferenceContext,
  AiMapInferenceOutput,
} from "./ai-map-inference";

export class SyntheticAiMapAdapter implements AiMapInferenceAdapter {
  readonly adapterName = "synthetic-ai-map-adapter-v1";
  readonly adapterVersion = "1.0.0";
  readonly modelName = "synthetic-generator";
  readonly modelVersion = "1.0.0";
  readonly inputPackageVersion = "recon-config-synthetic-v1";
  readonly inferencePipelineVersion = "pipeline-synthetic-v1";
  readonly supportedOutputs = ["current_hairline", "crown_center_reference"];

  async initialize(_config: AiMapInferenceConfig): Promise<void> {
    // No-op for synthetic adapter
  }

  async execute(
    _input: { readonly workspace: string; readonly reconstructionArtifactPath: string },
    context?: AiMapInferenceContext,
  ): Promise<AiMapInferenceOutput> {
    context?.onProgress?.(0, "Starting synthetic mapping...");
    await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate async work

    if (context?.signal?.aborted) {
      throw new Error("CANCELLED");
    }

    context?.onProgress?.(50, "Generating synthetic landmarks...");

    const output: AiMapInferenceOutput = {
      overallConfidence: 0.95,
      qualityState: "high",
      landmarks: [
        {
          landmark_code: "crown_center_reference",
          normalized_coordinate: [0.0, 10.0, -5.0],
          confidence: 0.99,
        },
      ],
      curves: [
        {
          curve_code: "current_hairline",
          closed: false,
          confidence: 0.9,
          control_points: [
            { id: "p1", order_index: 0, x: -5, y: 5, z: 5 },
            { id: "p2", order_index: 1, x: 0, y: 6, z: 6 },
            { id: "p3", order_index: 2, x: 5, y: 5, z: 5 },
          ],
        },
      ],
      regions: [],
    };

    context?.onProgress?.(100, "Synthetic mapping complete");
    return output;
  }

  async cleanup(): Promise<void> {
    // No-op for synthetic adapter
  }
}
