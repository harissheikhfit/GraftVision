import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(rootDirectory, "supabase", "migrations");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision AI-MAP policy verifier

Usage:
  corepack pnpm verify:ai-map-policy

Ensures AI-MAP tables exist and enforce queued -> running -> completed/failed transitions.`);
  process.exit(0);
}

let allSql = "";
const files = await readdir(migrationsDirectory);
for (const file of files.sort()) {
  if (file.endsWith(".sql")) {
    allSql += (await readFile(path.join(migrationsDirectory, file), "utf8")) + "\n";
  }
}

assert.match(
  allSql,
  /create table public\.ai_map_proposal_package/iu,
  "Missing ai_map_proposal_package table",
);
assert.match(
  allSql,
  /package_state text not null default 'queued' check \(package_state in \('queued', 'running', 'completed', 'failed', 'stale', 'superseded'\)\)/iu,
  "Missing exact state transitions for AI proposals",
);
assert.match(
  allSql,
  /create table public\.model_annotation_ai_provenance/iu,
  "Missing model_annotation_ai_provenance table",
);

const adapterCode = await readFile(
  path.join(rootDirectory, "packages", "database", "src", "onnx-ai-map-adapter.ts"),
  "utf8",
);
const fixtureTool = await readFile(
  path.join(rootDirectory, "tooling", "run-local-ai-map-fixture.mjs"),
  "utf8",
);
const integrationTest = await readFile(
  path.join(
    rootDirectory,
    "packages",
    "database",
    "src",
    "ai-map-inference-worker.integration.test.ts",
  ),
  "utf8",
);
assert.match(
  adapterCode,
  /modelSha256: "c5da94a32c18e367f7087cfcca541fc56287673af853a2c16be6c2d78ad16eb5"/u,
  "Missing exact ONNX SHA-256 pinned hash in adapter",
);

assert.match(adapterCode, /shape: \[1, 100\]/u, "Missing pinned ONNX input shape");
assert.match(adapterCode, /shape: \[1, 500\]/u, "Missing pinned ONNX output shape");
assert.doesNotMatch(
  adapterCode,
  /fallback/i,
  "AI inference must fail closed without fallback inference",
);
assert.match(
  allSql,
  /create table public\.ai_map_inference_execution/iu,
  "Missing trusted execution binding table",
);
assert.match(
  allSql,
  /input_shape integer\[\] not null check \(input_shape = array\[1,\s*100\]\)/iu,
  "Missing trusted input contract binding",
);
assert.match(
  allSql,
  /output_shape integer\[\] not null check \(output_shape = array\[1,\s*500\]\)/iu,
  "Missing trusted output contract binding",
);
assert.match(allSql, /AI_MAP_BINDING_DENIED/iu, "Missing model and tenant binding denial");
assert.match(allSql, /AI_MAP_OUTPUT_INVALID/iu, "Missing malformed output denial");
assert.match(fixtureTool, /127\.0\.0\.1.*54322/isu, "AI-MAP fixture must be loopback-only");
assert.match(
  fixtureTool,
  /graftvision_private\.set_tenant_context/iu,
  "AI-MAP fixture must establish tenant context",
);
assert.match(
  fixtureTool,
  /graftvision_private\.transition_doctor_verification/iu,
  "AI-MAP fixture must use the controlled Doctor verification transition",
);
assert.match(
  fixtureTool,
  /graftvision_private\.attest_clinic_onboarding/iu,
  "AI-MAP fixture must use controlled clinic readiness attestations",
);
assert.match(
  fixtureTool,
  /await client\.query\("commit"\)[\s\S]*?setTenant\(client, doctorId, clinicId\)/iu,
  "AI-MAP fixture must hand off from owner authority to a Doctor tenant context",
);
assert.match(
  fixtureTool,
  /reconstruction_worker/iu,
  "AI-MAP fixture must exercise worker lease context",
);
assert.match(
  fixtureTool,
  /artifactChecksum/iu,
  "AI-MAP fixture must verify the generated artifact checksum",
);
assert.match(
  integrationTest,
  /ai-map-002c-fixture\.json/iu,
  "Worker E2E must consume the generated fixture contract",
);
assert.match(
  JSON.parse(await readFile(path.join(rootDirectory, "package.json"), "utf8")).scripts[
    "ai-map:fixture:setup"
  ],
  /confirm-local-ai-map-fixture/u,
);

console.log("AI-MAP policy passed.");
