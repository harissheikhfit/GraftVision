import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./verify-cuda-reconstruction-worker-policy.mjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [adapter, poc, manifest, synthetic] = await Promise.all([
  readFile(path.join(root, "packages/database/src/real-reconstruction-engine.ts"), "utf8"),
  readFile(path.join(root, "tooling/run-local-real-reconstruction-poc.mjs"), "utf8"),
  readFile(path.join(root, "package.json"), "utf8"),
  readFile(path.join(root, "packages/database/src/reconstruction-engine.ts"), "utf8"),
]);
for (const fragment of [
  "server-only",
  "execFile",
  "shell: false",
  "colmap",
  "4.1.1",
  "BSD-3-Clause",
  "ENABLE_REAL_RECONSTRUCTION",
  "timeout",
  "maximumOutputBytes",
  "validateGlbOutput",
])
  assert(adapter.includes(fragment), `Missing real-engine safeguard: ${fragment}`);
assert(!adapter.includes("exec("), "The real-engine adapter must not use shell command execution.");
assert(poc.includes("confirm-local-real-reconstruction-poc"));
assert(poc.includes("generated-synthetic-asymmetric-raytraced-object-v2"));
assert(poc.includes("fixture_views"));
assert(poc.includes("registered_image_count"));
assert(poc.includes("dense_vertex_count"));
assert(poc.includes("patch_match_stereo"));
assert(poc.includes("stereo_fusion"));
assert(synthetic.includes("recon-engine-synthetic-v1"));
assert(JSON.parse(manifest).scripts.check.includes("verify-real-reconstruction-engine-policy"));
console.log(
  "Real reconstruction engine policy passed: COLMAP adapter is server-only, pinned, opt-in, bounded, and retains the synthetic fallback.",
);
