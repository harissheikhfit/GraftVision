import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildColmapCommand,
  detectColmapVersion,
  getRealReconstructionEngineConfig,
  REAL_ENGINE_VERSION,
  validateGlbOutput,
  RECONSTRUCTION_ARTIFACT_MIME_TYPES,
  RECONSTRUCTION_ARTIFACT_TYPES,
  RECONSTRUCTION_EXECUTION_MODES,
} from "./real-reconstruction-engine";

describe("real reconstruction engine adapter", () => {
  it("exports the exact bounded real-output contract", () => {
    expect(RECONSTRUCTION_ARTIFACT_TYPES).toEqual([
      "mesh_glb",
      "sparse_point_cloud",
      "dense_point_cloud",
      "surface_mesh",
      "reconstruction_preview",
      "bounded_metadata",
    ]);
    expect(RECONSTRUCTION_ARTIFACT_MIME_TYPES).toEqual([
      "model/gltf-binary",
      "application/ply",
      "model/obj",
      "application/json",
      "image/png",
      "image/webp",
      "application/octet-stream",
    ]);
    expect(RECONSTRUCTION_EXECUTION_MODES).toEqual(["synthetic", "sparse_cpu", "dense_cuda"]);
  });
  it("fails closed and builds argument-array commands", () => {
    expect(getRealReconstructionEngineConfig({})).toMatchObject({ enabled: false });
    expect(() => getRealReconstructionEngineConfig({ ENABLE_REAL_RECONSTRUCTION: "true" })).toThrow(
      "configuration",
    );
    expect(buildColmapCommand("/tmp/recon-job", "/tmp/recon-job/images")).toEqual(
      expect.arrayContaining(["feature_extractor", "--FeatureExtraction.use_gpu", "0"]),
    );
    expect(REAL_ENGINE_VERSION).toBe("4.1.1");
  });

  it("uses a fake runner for pinned version detection", async () => {
    const available = await detectColmapVersion(
      {
        enabled: true,
        executablePath: "/usr/local/bin/colmap",
        maximumOutputBytes: 1024,
        requiredVersion: "4.1.1",
        temporaryDirectoryRoot: "/tmp",
        timeoutMs: 1000,
      },
      { run: () => Promise.resolve({ exitCode: 0, stderr: "", stdout: "COLMAP 4.1.1" }) },
    );
    expect(available).toBe(true);
  });

  it("rejects malformed geometry output", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "graftvision-recon-"));
    const output = path.join(directory, "output.glb");
    await writeFile(output, "not-a-glb");
    await expect(validateGlbOutput(output, 1024)).rejects.toThrow("bounded GLB");
    await rm(directory, { recursive: true, force: true });
  });
});
