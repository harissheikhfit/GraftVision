import { describe, expect, it, vi } from "vitest";

import {
  buildCudaColmapPipeline,
  CUDA_RECONSTRUCTION_STAGES,
  runCudaReconstructionWorker,
  type CudaWorkerGateway,
  type ReconstructionWorkerClaim,
} from "./cuda-reconstruction-worker";

const claim: ReconstructionWorkerClaim = {
  attempt: 1,
  executionMode: "dense_cuda",
  jobId: "00000000-0000-4000-8000-000000000001",
  leaseRevision: 1,
  workerId: "00000000-0000-4000-8000-000000000002",
};

function gateway(): CudaWorkerGateway {
  return {
    claim: vi.fn().mockResolvedValue(claim),
    ensureLease: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    isCancelled: vi.fn().mockResolvedValue(false),
    materializePreparedInputs: vi.fn().mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({
        captureStep: `${index}`,
        fileName: `${index}.jpg`,
      })),
    ),
    publishDenseArtifact: vi.fn().mockResolvedValue(undefined),
    publishProgress: vi.fn().mockResolvedValue(undefined),
    validateDenseArtifact: vi.fn().mockResolvedValue({
      boundingBox: { max: [1, 1, 1], min: [0, 0, 0] },
      byteSize: 1,
      checksum: "0".repeat(64),
      pointCount: 1,
    }),
  };
}

describe("CUDA reconstruction worker", () => {
  it("uses bounded argument-array COLMAP dense stages", () => {
    const commands = buildCudaColmapPipeline("/tmp/recon", "/tmp/recon/inputs");
    expect(commands).toHaveLength(6);
    expect(commands.map((command) => command[0])).toEqual([
      "feature_extractor",
      "exhaustive_matcher",
      "mapper",
      "image_undistorter",
      "patch_match_stereo",
      "stereo_fusion",
    ]);
  });

  it("runs a lease-checked dense pipeline with a fake process runner", async () => {
    const state = gateway();
    await expect(
      runCudaReconstructionWorker({
        capability: {
          colmapVersion: "4.1.1",
          cudaVersion: "12.4",
          gpuModelCode: "TEST_GPU",
          supportsDense: true,
        },
        gateway: state,
        runner: { run: vi.fn().mockResolvedValue(undefined) },
        timeoutMs: 1000,
        workspace: "/tmp/recon",
      }),
    ).resolves.toBe("completed");
    // The fixture supplies Vitest mocks through the typed worker gateway interface.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(state.publishProgress).toHaveBeenCalledWith(claim, "dense_stereo");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(state.finalize).toHaveBeenCalledWith(claim);
  });

  it("fails closed for a sparse-only worker", async () => {
    const state = gateway();
    await expect(
      runCudaReconstructionWorker({
        capability: {
          colmapVersion: "4.1.1",
          cudaVersion: "12.4",
          gpuModelCode: "TEST_GPU",
          supportsDense: false,
        },
        gateway: state,
        runner: { run: vi.fn() },
        timeoutMs: 1000,
        workspace: "/tmp/recon",
      }),
    ).rejects.toThrow("Dense CUDA is unavailable");
  });

  it("keeps the exact monotonic stage catalogue", () => {
    expect(CUDA_RECONSTRUCTION_STAGES).toEqual(
      expect.arrayContaining(["dense_stereo", "stereo_fusion", "completed"]),
    );
  });
});
