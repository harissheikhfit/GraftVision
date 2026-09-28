import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, vi, afterAll } from "vitest";

import { AiMapInferenceError } from "./ai-map-inference.js";
import {
  queueAiMapProposal,
  beginAiMapProposalExecution,
  recordAiMapProposalOutput,
  finalizeAiMapProposal,
  failAiMapProposal,
} from "./ai-map.js";
import {
  createExpandedOnnxInput,
  EXPANDED_ONNX_MODEL_CONTRACT,
  OnnxAiMapInferenceAdapter,
} from "./onnx-ai-map-adapter.js";

// Ensure strict sandbox boundaries
vi.stubEnv("TMPDIR", tmpdir());
vi.stubEnv("TEMP", tmpdir());
vi.stubEnv("TMP", tmpdir());

vi.mock("./ai-map.js", () => ({
  queueAiMapProposal: vi.fn().mockResolvedValue({ proposalId: "test-proposal-123", isNew: true }),
  beginAiMapProposalExecution: vi.fn().mockResolvedValue({
    executionId: "test-execution-123",
    isNew: true,
  }),
  recordAiMapProposalOutput: vi.fn().mockResolvedValue(undefined),
  finalizeAiMapProposal: vi.fn().mockResolvedValue(undefined),
  failAiMapProposal: vi.fn().mockResolvedValue(undefined),
}));

describe("AI-MAP-002B2: Genuine Model-Runtime Inference (Expanded ONNX POC)", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should execute genuine tensor inference for all expanded outputs", async () => {
    const adapter = new OnnxAiMapInferenceAdapter();
    await adapter.initialize({ timeoutMs: 30000, temporaryDirectoryRoot: tmpdir() });

    const workspace = await fs.mkdtemp(join(tmpdir(), "graftvision-expanded-onnx-"));
    const dummyArtifactPath = join(workspace, `dummy-artifact-expanded-onnx-${Date.now()}.glb`);
    await fs.writeFile(
      dummyArtifactPath,
      Buffer.from("glTF\x02\x00\x00\x00\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", "ascii"),
    );

    let proposalId = "";
    let executionId = "";
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mockTx = {} as unknown as import("./index.js").TenantTransaction;

    try {
      const queueRes = await queueAiMapProposal(mockTx, {
        applicationSessionId: "dummy-session",
        providerIdentityId: "dummy-provider",
        scanSessionId: "dummy-scan",
        analyzerHandoffId: "dummy-handoff",
        idempotencyKey: "dummy-key",
      });
      proposalId = queueRes.proposalId;

      const execution = await beginAiMapProposalExecution(mockTx, {
        proposalId,
        clinicId: "11111111-1111-4111-8111-111111111111",
        workerId: "22222222-2222-4222-8222-222222222222",
        reconstructionJobId: "33333333-3333-4333-8333-333333333333",
        reconstructionAttemptCount: 1,
        adapterName: "onnx-ai-map-adapter-v2",
        adapterVersion: "2.0.0-dev",
        modelName: "graftvision-synthetic-scalp-segmentation",
        modelVersion: "0.2.0",
        pipelineVersion: "graftvision-ai-map-onnx-pipeline-v2",
        artifactChecksum: "a".repeat(64),
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      });
      executionId = execution.executionId;

      const result = await adapter.execute(
        { workspace, reconstructionArtifactPath: dummyArtifactPath },
        {
          onProgress: (_pct, _status) => {
            // no-op
          },
        },
      );

      // Verify Expanded Contract
      expect(result.landmarks.length).toBe(4);
      expect(result.curves.length).toBe(6);
      expect(result.regions.length).toBe(9);

      const expectedLandmarks = [
        "crown_center_reference",
        "left_temporal_reference",
        "right_temporal_reference",
        "donor_center_reference",
      ];
      expect(result.landmarks.map((l) => l.landmark_code).sort()).toEqual(expectedLandmarks.sort());

      const expectedCurves = [
        "current_hairline",
        "donor_upper_boundary",
        "donor_lower_boundary",
        "left_temporal_boundary",
        "right_temporal_boundary",
        "crown_boundary",
      ];
      expect(result.curves.map((c) => c.curve_code).sort()).toEqual(expectedCurves.sort());

      const expectedRegions = [
        "frontal_recipient_region",
        "mid_scalp_region",
        "crown_region",
        "donor_rear_region",
        "donor_left_region",
        "donor_right_region",
        "left_temporal_region",
        "right_temporal_region",
        "exclusion_region",
      ];
      expect(result.regions.map((r) => r.region_code).sort()).toEqual(expectedRegions.sort());

      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1.0);

      // Simulate persistence mapping
      await recordAiMapProposalOutput(mockTx, {
        executionId,
        landmarks: result.landmarks,
        curves: result.curves,
        regions: result.regions,
      });

      await finalizeAiMapProposal(mockTx, {
        executionId,
        overallConfidence: result.overallConfidence,
        qualityState: result.qualityState,
      });
    } catch (err) {
      if (proposalId) {
        await failAiMapProposal(mockTx, {
          executionId: executionId,
          failureCode: "INFERENCE_FAILED",
        });
      }
      throw err;
    } finally {
      await adapter.cleanup();
      await fs.unlink(dummyArtifactPath).catch(() => {});
    }

    expect(queueAiMapProposal).toHaveBeenCalled();
    expect(beginAiMapProposalExecution).toHaveBeenCalled();
    expect(recordAiMapProposalOutput).toHaveBeenCalledTimes(1);
    expect(finalizeAiMapProposal).toHaveBeenCalled();
    expect(failAiMapProposal).not.toHaveBeenCalled();
  });

  it("enforces the pinned synthetic tensor contract before native execution", () => {
    const values = Array.from({ length: 100 }, (_, index) => index);
    const tensor = createExpandedOnnxInput(values, EXPANDED_ONNX_MODEL_CONTRACT.input.shape);
    expect(tensor).toBeInstanceOf(Float32Array);
    expect(tensor).toHaveLength(100);
    expect(tensor[99]).toBeCloseTo(99 / 255);
    expect(() => createExpandedOnnxInput(values, [1, 3, 224, 224])).toThrow(AiMapInferenceError);
    expect(() => createExpandedOnnxInput([...values.slice(0, 99), Number.NaN], [1, 100])).toThrow(
      AiMapInferenceError,
    );
    expect(() => createExpandedOnnxInput(values.slice(0, 99), [1, 100])).toThrow(
      AiMapInferenceError,
    );
  });
});
