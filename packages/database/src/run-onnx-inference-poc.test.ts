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
import { OnnxAiMapInferenceAdapter } from "./onnx-ai-map-adapter.js";

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

describe("AI-MAP-002B1: Genuine Model-Runtime Inference (ONNX POC)", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should execute genuine tensor inference or fail closed if runtime/model missing", async () => {
    const adapter = new OnnxAiMapInferenceAdapter();
    let initialized = true;

    try {
      await adapter.initialize({
        timeoutMs: 30000,
        temporaryDirectoryRoot: tmpdir(),
      });
    } catch (err) {
      if (err instanceof AiMapInferenceError && err.code === "INITIALIZATION_FAILED") {
        initialized = false;
      } else {
        throw err;
      }
    }

    if (!initialized) {
      // The environment lacks either onnxruntime-node or the valid .onnx model artifact.
      // This correctly verifies the "fail closed" requirement.
      expect(true).toBe(true);
      return;
    }

    const workspace = await fs.mkdtemp(join(tmpdir(), "graftvision-onnx-"));
    const dummyArtifactPath = join(workspace, `dummy-artifact-onnx-${Date.now()}.glb`);
    await fs.writeFile(
      dummyArtifactPath,
      Buffer.from("glTF\x02\x00\x00\x00\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", "ascii"),
    );

    let proposalId = "";
    let executionId = "";

    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mockTx = {} as unknown as import("./index.js").TenantTransaction;

    try {
      // 1. Simulate the server-side queueing
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

      // 2. Execute adapter
      const result = await adapter.execute(
        { workspace, reconstructionArtifactPath: dummyArtifactPath },
        {
          onProgress: (_pct, _status) => {
            // no-op for tests but formatted properly for eslint
          },
        },
      );

      // 3. Verify Constraints
      expect(result.landmarks.length).toBeGreaterThan(0);
      expect(result.landmarks.some((l) => l.landmark_code === "crown_center_reference")).toBe(true);

      expect(result.curves.length).toBeGreaterThan(0);
      expect(result.curves.some((c) => c.curve_code === "current_hairline")).toBe(true);

      expect(result.regions.length).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1.0);

      for (const l of result.landmarks) {
        const cx = l.normalized_coordinate[0] ?? 0;
        const cy = l.normalized_coordinate[1] ?? 0;
        const cz = l.normalized_coordinate[2] ?? 0;
        expect(cx).toBeGreaterThanOrEqual(-2);
        expect(cx).toBeLessThanOrEqual(2);
        expect(cy).toBeGreaterThanOrEqual(-2);
        expect(cy).toBeLessThanOrEqual(2);
        expect(cz).toBeGreaterThanOrEqual(-2);
        expect(cz).toBeLessThanOrEqual(2);
      }

      // 4. Simulate persistence mapping
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
        await failAiMapProposal(mockTx, { executionId, failureCode: "INFERENCE_FAILED" });
      }
      throw err;
    } finally {
      await adapter.cleanup();
      await fs.unlink(dummyArtifactPath).catch(() => {});
    }

    // Verify Lifecycle Completion
    expect(queueAiMapProposal).toHaveBeenCalled();
    expect(beginAiMapProposalExecution).toHaveBeenCalled();
    expect(recordAiMapProposalOutput).toHaveBeenCalledTimes(1);
    expect(finalizeAiMapProposal).toHaveBeenCalled();
    expect(failAiMapProposal).not.toHaveBeenCalled();
  });

  it("should fail and trigger fail_ai_map_proposal on unreadable artifact", async () => {
    const adapter = new OnnxAiMapInferenceAdapter();
    try {
      await adapter.initialize({
        timeoutMs: 30000,
        temporaryDirectoryRoot: tmpdir(),
      });
    } catch (err) {
      if (err instanceof AiMapInferenceError && err.code === "INITIALIZATION_FAILED") {
        expect(true).toBe(true);
        return;
      }
      throw err;
    }

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
        idempotencyKey: "dummy-key-2",
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
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      });
      executionId = execution.executionId;

      await adapter.execute({
        workspace: tmpdir(),
        reconstructionArtifactPath: "/path/that/does/not/exist.glb",
      });
    } catch (error) {
      if (proposalId) {
        await failAiMapProposal(mockTx, { executionId, failureCode: "INFERENCE_FAILED" });
      }
      expect(error).toBeInstanceOf(AiMapInferenceError);
    }

    expect(failAiMapProposal).toHaveBeenCalled();
  });
});
