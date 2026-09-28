import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const migrationName = "20260801000006_scan_media_upload.sql";
const [migrations, migration, route, shell, manifest] = await Promise.all([
  readdir(path.join(root, "supabase/migrations")),
  read(`supabase/migrations/${migrationName}`),
  read("apps/web/src/app/api/scan-sessions/[scanSessionId]/media/route.ts"),
  read("apps/scan/src/app/session/capture-shell.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes(migrationName), "SCAN-004 requires an additive media migration.");
for (const required of [
  "scan_capture_asset",
  "scan_capture_upload_event",
  "scan_capture_upload_idempotency",
  "force row level security",
  "register_scan_capture_asset",
  "authorise_scan_capture_upload",
  "SCAN_MEDIA_IDEMPOTENCY_MISMATCH",
  "SCAN_MEDIA_RETAKE_REQUIRED",
  "scan_capture.upload_completed",
  "scan_capture.asset_superseded",
])
  assert(migration.includes(required), `Missing SCAN-004 boundary: ${required}`);
for (const prohibited of [
  "bytea",
  "public = true",
  "storage.objects",
  "patient_number",
  "full_name",
]) {
  assert(!migration.includes(prohibited), `Media upload must not persist or expose: ${prohibited}`);
}
for (const required of [
  "hasValidSignature",
  "uploadPrivateClinicalCaptureObject",
  "authoriseScanCaptureUpload",
  "registerScanCaptureAsset",
]) {
  assert(route.includes(required), `Upload route is missing: ${required}`);
}
for (const required of [
  "Upload image",
  "Retry upload",
  "Image uploaded securely",
  "idempotencyKey",
]) {
  assert(shell.includes(required), `Capture shell is missing: ${required}`);
}
assert.equal(
  manifest.scripts["verify:scan-media-upload-policy"],
  "node tooling/verify-scan-media-upload-policy.mjs",
);
assert.equal(
  manifest.scripts["scan:test:media-upload"],
  "node tooling/run-local-scan-media-upload.mjs --confirm-local-scan-media-upload",
);
assert(manifest.scripts.check.includes("node tooling/verify-scan-media-upload-policy.mjs"));
console.log(
  "SCAN-004 media-upload policy passed: private storage, trusted keys, controlled metadata, retries, and immutable supersession remain enforced.",
);
