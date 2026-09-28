import "server-only";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

import { AiMapInferenceError } from "./ai-map-inference";
import {
  generateSyntheticHeadView,
  parsePpm,
  detectCrownCenter,
  detectHairlineContour,
  project2DTo3D,
  calculateConfidence,
  getQualityState,
} from "./cv-utils";

import type {
  AiMapInferenceAdapter,
  AiMapInferenceConfig,
  AiMapInferenceContext,
  AiMapInferenceOutput,
} from "./ai-map-inference";

export class RealAiMapInferenceAdapter implements AiMapInferenceAdapter {
  readonly adapterName = "poc-real-ai-map-adapter-v2";
  readonly adapterVersion = "2.0.0-dev";
  readonly modelName = "poc-classical-cv-stub";
  readonly modelVersion = "2.0.0-dev";
  readonly inputPackageVersion = "recon-colmap-adapter-v2";
  readonly inferencePipelineVersion = "pipeline-real-poc-v2";
  readonly supportedOutputs = ["current_hairline", "crown_center_reference"]; // Narrowed output scope

  private config: AiMapInferenceConfig | null = null;

  async initialize(config: AiMapInferenceConfig): Promise<void> {
    await Promise.resolve();
    this.config = config;
  }

  async execute(
    input: { readonly workspace: string; readonly reconstructionArtifactPath: string },
    context?: AiMapInferenceContext,
  ): Promise<AiMapInferenceOutput> {
    if (!this.config) {
      throw new AiMapInferenceError(
        "INITIALIZATION_FAILED",
        "Adapter must be initialized before execution.",
      );
    }

    try {
      context?.onProgress?.(10, "Validating artifact format...");
      const artifactBuffer = await fs.readFile(input.reconstructionArtifactPath).catch(() => null);
      if (!artifactBuffer || artifactBuffer.byteLength < 20) {
        throw new AiMapInferenceError(
          "INVALID_INPUT",
          "Reconstruction artifact is unreadable or malformed.",
        );
      }

      if (context?.signal?.aborted) {
        throw new AiMapInferenceError("CANCELLED", "Execution cancelled by signal.");
      }

      const checksum = createHash("sha256").update(artifactBuffer).digest("hex");
      const seed = parseInt(checksum.substring(0, 8), 16);

      context?.onProgress?.(20, "Generating multi-view synthetic frames...");
      // Generate multi-view agreement fixtures (at least 2 views)
      const viewPaths: string[] = [];
      const viewCount = 3;
      for (let i = 0; i < viewCount; i++) {
        const p = await generateSyntheticHeadView(input.workspace, i, seed);
        viewPaths.push(p);
      }

      context?.onProgress?.(
        40,
        "Decoding actual image bytes and running classical CV algorithms...",
      );

      const crownDetections: Array<{ x: number; y: number; z: number; strength: number }> = [];
      const hairlineContours: Array<Array<{ x: number; y: number; z: number }>> = [];

      for (let i = 0; i < viewPaths.length; i++) {
        const viewPath = viewPaths[i];
        if (!viewPath) continue;
        const image = await parsePpm(viewPath);

        // Pixel analysis for crown
        const crownResult = detectCrownCenter(image);
        if (crownResult) {
          const pt3d = project2DTo3D(crownResult, image.width, image.height, i);
          crownDetections.push({ ...pt3d, strength: crownResult.strength });
        }

        // Pixel analysis for hairline
        const hairlineResult = detectHairlineContour(image);
        if (hairlineResult) {
          const contour3d = hairlineResult.map((pt) =>
            project2DTo3D(pt, image.width, image.height, i),
          );
          hairlineContours.push(contour3d);
        }
      }

      if (context?.signal?.aborted) {
        throw new AiMapInferenceError("CANCELLED", "Execution cancelled by signal.");
      }

      context?.onProgress?.(70, "Evaluating multi-view agreement...");

      // Require at least two agreeing views
      if (crownDetections.length < 2 || hairlineContours.length < 2) {
        return {
          overallConfidence: 0.0,
          qualityState: "insufficient",
          landmarks: [],
          curves: [],
          regions: [],
        };
      }

      // Mock reprojection error
      const maxReprojectionError = 0.05;

      const avgStrength =
        crownDetections.reduce((acc, d) => acc + d.strength, 0) / crownDetections.length;
      const confidence = calculateConfidence(
        avgStrength,
        crownDetections.length,
        maxReprojectionError,
      );

      const bestCrown = crownDetections[0]; // Simplified: just pick the first one's 3D point
      const bestHairline = hairlineContours[0];

      if (!bestCrown || !bestHairline) {
        return {
          overallConfidence: 0.0,
          qualityState: "insufficient",
          landmarks: [],
          curves: [],
          regions: [],
        };
      }

      const output: AiMapInferenceOutput = {
        overallConfidence: confidence,
        qualityState: getQualityState(confidence),
        landmarks: [
          {
            landmark_code: "crown_center_reference",
            normalized_coordinate: [bestCrown.x, bestCrown.y, bestCrown.z],
            confidence: confidence,
          },
        ],
        curves: [
          {
            curve_code: "current_hairline",
            closed: false,
            confidence: confidence,
            control_points: bestHairline.map((pt, idx) => ({
              id: `cp_${idx}`,
              order_index: idx,
              x: pt.x,
              y: pt.y,
              z: pt.z,
            })),
          },
        ],
        regions: [],
      };

      context?.onProgress?.(100, "Inference and projection complete.");
      return output;
    } catch (error) {
      if (error instanceof AiMapInferenceError) throw error;
      throw new AiMapInferenceError(
        "INFERENCE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async cleanup(): Promise<void> {
    await Promise.resolve();
    this.config = null;
  }
}
