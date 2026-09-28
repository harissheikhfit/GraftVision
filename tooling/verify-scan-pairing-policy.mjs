import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const migrationName = "20260801000052_scan_permission_contract_fix.sql";
const [migrations, migration, pairingMigration, database, webActions, pairRoute, packageJson] =
  await Promise.all([
    readdir(path.join(root, "supabase/migrations")),
    read(`supabase/migrations/${migrationName}`),
    read("supabase/migrations/20260801000004_scan_pairing_redemption.sql"),
    read("packages/database/src/scan-session.ts"),
    read(
      "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/scan-pairing-actions.ts",
    ),
    read("apps/web/src/app/api/scan/pair/route.ts"),
    read("package.json").then(JSON.parse),
  ]);

assert(migrations.includes(migrationName), "SCAN-002 pairing migration is required.");
for (const token of [
  "redeem_scan_session_token",
  "read_scan_session_status",
  "has_application_session_permission",
  "doctor_verification",
  "pair_scan_session",
])
  assert(pairingMigration.includes(token), `Missing SCAN-002 boundary: ${token}`);
assert(migration.includes("SCAN-PERM-001"), "SCAN-002 permission correction is required.");
assert(
  migration.includes("transition_scan_session_status"),
  "SCAN-002 must correct the scan lifecycle transition permission.",
);
assert(
  migration.includes("pg_get_functiondef"),
  "SCAN-002 must preserve existing scan function definitions while correcting permission literals.",
);
for (const prohibited of [
  "token_hash, pairing_nonce",
  "patient_number",
  "full_name",
  "clinical_history",
]) {
  assert(!migration.includes(prohibited), `Prohibited scan pairing projection: ${prohibited}`);
}
assert(database.includes("redeemScanSessionToken"));
assert(database.includes("readScanSessionStatus"));
assert(webActions.includes("hashScanToken(rawToken"));
assert(webActions.includes("QRCode.toDataURL"));
assert(pairRoute.includes("randomBytes(32)"));
assert(pairRoute.includes("redeemScanSessionToken"));
assert.equal(
  packageJson.scripts["verify:scan-pairing-policy"],
  "node tooling/verify-scan-pairing-policy.mjs",
);
assert.equal(
  packageJson.scripts["scan:test:pairing"],
  "node tooling/run-local-scan-pairing.mjs --confirm-local-scan-pairing",
);
assert(packageJson.scripts.check.includes("node tooling/verify-scan-pairing-policy.mjs"));
console.log(
  "SCAN-002 pairing policy passed: secret-only QR redemption, protected status polling, and no patient projection.",
);
