import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [
  migrationNames,
  saveMigration,
  retakeStateMigration,
  retakeMigration,
  auditMigration,
  overrideMigration,
  projectionMigration,
  technicalMigration,
  handoffMigration,
  boundary,
  types,
  test,
  overrideTest,
  matrixTest,
  manifest,
] = await Promise.all([
  readdir(path.join(root, "supabase/migrations")),
  read("supabase/migrations/20260801000009_scan_quality_save.sql"),
  read("supabase/migrations/20260801000012_scan_quality_retake_state.sql"),
  read("supabase/migrations/20260801000013_scan_quality_retake_operation.sql"),
  read("supabase/migrations/20260801000014_scan_quality_retake_audit.sql"),
  read("supabase/migrations/20260801000015_scan_quality_doctor_override.sql"),
  read("supabase/migrations/20260801000016_scan_quality_projections.sql"),
  read("supabase/migrations/20260801000017_scan_technical_quality.sql"),
  read("supabase/migrations/20260801000018_scan_analyzer_handoff.sql"),
  read("packages/database/src/scan-session.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("supabase/tests/database/scan_quality_retake.test.sql"),
  read("supabase/tests/database/scan_quality_doctor_override.test.sql"),
  read("supabase/tests/database/scan_quality_matrix.test.sql"),
  read("package.json").then(JSON.parse),
]);

assert.equal(migrationNames.filter((name) => name.endsWith(".sql")).length, 74);
for (const migration of [
  "20260801000008_scan_quality_foundation.sql",
  "20260801000009_scan_quality_save.sql",
  "20260801000012_scan_quality_retake_state.sql",
  "20260801000013_scan_quality_retake_operation.sql",
  "20260801000014_scan_quality_retake_audit.sql",
  "20260801000015_scan_quality_doctor_override.sql",
  "20260801000016_scan_quality_projections.sql",
  "20260801000017_scan_technical_quality.sql",
  "20260801000018_scan_analyzer_handoff.sql",
]) {
  assert(migrationNames.includes(migration), `Missing required SCAN-005 migration: ${migration}`);
}
for (const source of [saveMigration, retakeStateMigration, retakeMigration]) {
  assert(source.includes("force row level security"));
  assert(source.includes("enforce_controlled_scan_mutation"));
}
for (const required of [
  "request_scan_quality_retake",
  "require_scan_capture_context",
  "SCAN_QUALITY_CONFLICT",
  "SCAN_QUALITY_IDEMPOTENCY_MISMATCH",
  "retake_required",
  "prior_result_id = current_result_id",
]) {
  assert(retakeMigration.includes(required), `Missing controlled retake boundary: ${required}`);
}
assert(auditMigration.includes("scan_quality.retake_requested"));
for (const key of [
  "scan_session_id",
  "asset_id",
  "capture_step",
  "reason_code",
  "result_revision",
]) {
  assert(auditMigration.includes(`'${key}'`), `Missing redacted retake audit key: ${key}`);
}
for (const prohibited of ["object_key", "checksum", "signed_url", "exif", "patient_id"]) {
  assert(!auditMigration.includes(prohibited), `Retake audit must not contain ${prohibited}.`);
}
assert(boundary.includes("requestScanQualityRetake"));
assert(boundary.includes("request_scan_quality_retake"));
assert(types.includes('"scan_quality.retake_requested"'));
assert(test.includes("scan_quality.retake_requested"));
for (const required of [
  "override_scan_quality_result",
  "is_assigned_verified_doctor",
  "doctor_overridden",
  "scan_quality.override_recorded",
]) {
  assert(
    overrideMigration.includes(required),
    `Missing controlled Doctor override boundary: ${required}`,
  );
}
for (const structuralReason of [
  "IMAGE_TOO_SMALL",
  "INVALID_ORIENTATION",
  "DUPLICATE_ANGLE_IMAGE",
  "ANGLE_MISMATCH",
  "ASSET_REPLACED",
]) {
  assert(overrideMigration.includes(structuralReason));
}
assert(boundary.includes("overrideScanQualityResult"));
assert(types.includes('"scan_quality.override_recorded"'));
assert(overrideTest.includes("scan_quality.override_recorded"));
for (const required of [
  "read_scan_quality_matrix",
  "read_scan_package_readiness",
  "MISSING_REQUIRED_ASSET",
  "MISSING_QUALITY_RESULT",
  "QUALITY_PENDING",
  "QUALITY_WARNING",
  "RETAKE_REQUIRED",
  "QUALITY_INVALIDATED",
  "STALE_QUALITY_RESULT",
  "SESSION_NOT_ELIGIBLE",
  "CONSULTATION_NOT_ANALYZER_READY",
  "STRUCTURAL_FAILURE_PRESENT",
]) {
  assert(
    projectionMigration.includes(required),
    `Missing quality projection boundary: ${required}`,
  );
}
for (const prohibited of ["object_key", "checksum", "signed_url", "exif", "image_bytes"]) {
  assert(
    !matrixTest.includes(`select ${prohibited}`),
    `Safe matrix must not project ${prohibited}.`,
  );
}
assert(boundary.includes("readScanQualityMatrix"));
assert(boundary.includes("readScanPackageReadiness"));
for (const required of [
  "invalidate_scan_quality_for_replaced_asset",
  "ASSET_REPLACED",
  "is_duplicate_scan_capture_checksum",
]) {
  assert(
    technicalMigration.includes(required),
    `Missing deterministic technical validation: ${required}`,
  );
}
assert(boundary.includes("isDuplicateScanCaptureChecksum"));
for (const required of [
  "create_scan_analyzer_handoff",
  "is_assigned_verified_doctor",
  "read_scan_package_readiness",
  "scan_quality.analyzer_handoff_created",
  "force row level security",
]) {
  assert(handoffMigration.includes(required), `Missing analyzer handoff control: ${required}`);
}
assert(boundary.includes("createScanAnalyzerHandoff"));
assert(types.includes('"scan_quality.analyzer_handoff_created"'));
assert(matrixTest.includes("required_steps"));
assert.equal(
  manifest.scripts["scan:test:quality"],
  "node tooling/run-local-scan-quality.mjs --confirm-local-scan-quality",
);
assert.equal(
  manifest.scripts["verify:scan-quality-policy"],
  "node tooling/verify-scan-quality-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-scan-quality-policy.mjs"));

console.log(
  "SCAN-005 quality policy passed: controlled retakes and assigned-Doctor overrides retain strict context, idempotency, redaction, and deny-by-default table access.",
);
