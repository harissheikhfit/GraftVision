import { describe, expect, it, vi } from "vitest";

import { executeAiMapInferenceWorker } from "./ai-map-inference-worker";

import type { AiMapInferenceAdapter } from "./ai-map-inference";
import type { TenantTransaction } from "./server";

vi.mock("./ai-map.js", () => ({
  beginAiMapProposalExecution: vi
    .fn()
    .mockResolvedValue({ executionId: "55555555-5555-4555-8555-555555555555", isNew: true }),
  recordAiMapProposalOutput: vi.fn().mockResolvedValue(undefined),
  finalizeAiMapProposal: vi.fn().mockResolvedValue(undefined),
  failAiMapProposal: vi.fn().mockResolvedValue(undefined),
}));

const id = "11111111-1111-4111-8111-111111111111";
const validOutput = {
  overallConfidence: 0.8,
  qualityState: "high" as const,
  landmarks: [
    {
      landmark_code: "crown_center_reference" as const,
      normalized_coordinate: [0, 0, 0] as [number, number, number],
      confidence: 0.8,
    },
  ],
  curves: [],
  regions: [],
};

function adapter(output = validOutput): AiMapInferenceAdapter {
  return {
    adapterName: "onnx-ai-map-adapter-v2",
    adapterVersion: "2.0.0-dev",
    modelName: "graftvision-synthetic-scalp-segmentation",
    modelVersion: "0.2.0",
    inputPackageVersion: "recon-colmap-adapter-v2",
    inferencePipelineVersion: "graftvision-ai-map-onnx-pipeline-v2",
    supportedOutputs: [],
    initialize: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue(output),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AI-MAP-002C trusted inference worker", () => {
  it("passes explicit tenant and lease identity to the DB boundary and invokes the supplied adapter once", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const transaction = { query } as unknown as TenantTransaction;
    const inferenceAdapter = adapter();

    const result = await executeAiMapInferenceWorker(
      transaction,
      {
        proposalId: id,
        clinicId: id,
        workerId: id,
        reconstructionJobId: id,
        reconstructionAttemptCount: 1,
        artifactPath: "/tmp/synthetic.glb",
        artifactChecksum: "a".repeat(64),
        idempotencyKey: id,
        workspace: "/tmp",
      },
      inferenceAdapter,
    );

    expect(result.isNew).toBe(true);
    expect(result.output).toEqual(validOutput);
    expect(query).toHaveBeenCalledWith(
      "select set_config('graftvision.reconstruction_worker','on',true)",
    );
  });

  it("fails closed on non-finite or out-of-bounds adapter geometry", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as TenantTransaction;
    const inferenceAdapter = adapter({
      ...validOutput,
      landmarks: [{ ...validOutput.landmarks[0]!, normalized_coordinate: [Number.NaN, 0, 0] }],
    });

    await expect(
      executeAiMapInferenceWorker(
        transaction,
        {
          proposalId: id,
          clinicId: id,
          workerId: id,
          reconstructionJobId: id,
          reconstructionAttemptCount: 1,
          artifactPath: "/tmp/synthetic.glb",
          artifactChecksum: "a".repeat(64),
          idempotencyKey: id,
          workspace: "/tmp",
        },
        inferenceAdapter,
      ),
    ).rejects.toThrow("geometry");
  });
});
