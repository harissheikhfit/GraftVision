import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [dockerfile, entrypoint, worker] = await Promise.all([
  readFile(path.join(root, "workers/reconstruction/Dockerfile"), "utf8"),
  readFile(path.join(root, "workers/reconstruction/entrypoint.sh"), "utf8"),
  readFile(path.join(root, "packages/database/src/cuda-reconstruction-worker.ts"), "utf8"),
]);
for (const fragment of [
  "nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04",
  "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04",
  "COLMAP_GIT_REF=4.1.1",
  "CUDA_ENABLED=ON",
  "USER 10001:10001",
  "RECONSTRUCTION_WORKSPACE_ROOT=/var/lib/graftvision/reconstruction",
  "NVIDIA_DRIVER_CAPABILITIES=compute,utility",
])
  assert(dockerfile.includes(fragment), `Missing CUDA worker hardening: ${fragment}`);
assert(
  !/privileged|docker\.sock|latest/iu.test(dockerfile),
  "CUDA worker must not use privileged, Docker socket, or floating tags.",
);
assert(entrypoint.includes("RECONSTRUCTION_WORKER_ENTRYPOINT"));
for (const fragment of [
  "CUDA_RECONSTRUCTION_STAGES",
  "dense_cuda",
  "ensureLease",
  "isCancelled",
  "validateDenseArtifact",
  "patch_match_stereo",
  "stereo_fusion",
  "CUDA_UNAVAILABLE",
  "DENSE_STEREO_FAILED",
])
  assert(worker.includes(fragment), `Missing CUDA worker boundary: ${fragment}`);
console.log(
  "CUDA reconstruction worker policy passed: pinned CUDA/COLMAP build, non-root runtime, bounded orchestration, and dense fail-closed controls are present.",
);
