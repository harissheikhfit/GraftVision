import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const migrationName = "20260801000005_scan_capture_shell.sql";
const [migrations, migration, database, captureRoute, scanShell, packageJson] = await Promise.all([
  readdir(path.join(root, "supabase/migrations")),
  read(`supabase/migrations/${migrationName}`),
  read("packages/database/src/scan-session.ts"),
  read("apps/web/src/app/api/scan-sessions/[scanSessionId]/capture/route.ts"),
  read("apps/scan/src/app/session/capture-shell.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(
  migrations.includes(migrationName),
  "SCAN-003 must use its additive capture-state migration.",
);
for (const fragment of [
  "scan_capture_state",
  "scan_capture_event",
  "read_scan_capture_state",
  "record_scan_capture_step",
  "force row level security",
  "SCAN_CAPTURE_DENIED",
  "INVALID_CAPTURE_TRANSITION",
  "scan_session.complete",
  "capture_complete",
])
  assert(migration.includes(fragment), `Missing SCAN-003 capture boundary: ${fragment}`);
for (const prohibited of ["bytea", "storage.objects", "patient_number", "full_name"]) {
  assert(!migration.includes(prohibited), `Capture persistence must not include: ${prohibited}`);
}
assert(database.includes("SCAN_CAPTURE_STEPS"));
assert(database.includes("recordScanCaptureStep"));
assert(captureRoute.includes("recordScanCaptureStep"));
assert(captureRoute.includes("SCAN_CAPTURE_DENIED"));
for (const fragment of [
  "getUserMedia",
  "local preview",
  "Capture complete",
  "progress",
  "Retake",
]) {
  assert(scanShell.includes(fragment), `Missing mobile capture-shell behavior: ${fragment}`);
}
assert.equal(
  packageJson.scripts["verify:scan-capture-shell-policy"],
  "node tooling/verify-scan-capture-shell-policy.mjs",
);
assert.equal(
  packageJson.scripts["scan:test:capture-shell"],
  "node tooling/run-local-scan-capture-shell.mjs --confirm-local-scan-capture-shell",
);
assert(packageJson.scripts.check.includes("node tooling/verify-scan-capture-shell-policy.mjs"));
console.log(
  "SCAN-003 capture-shell policy passed: controlled resumable checklist state, private local previews, and protected capture mutations are enforced.",
);
