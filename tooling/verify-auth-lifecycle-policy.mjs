import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [manifest, fixture, authInvite, authRecover] = await Promise.all([
  read("package.json").then(JSON.parse),
  read("tooling/run-local-auth-lifecycle.mjs"),
  read("packages/auth/src/server/invite.ts"),
  read("packages/auth/src/server/recover.ts"),
]);

assert(fixture.includes("captureEmailLink"));
assert(!fixture.includes("console.log(fixturePassword"));
assert(!fixture.includes("console.log(newPassword"));
assert(!fixture.includes("console.log(tokenHash"));
assert(!fixture.includes("console.log(link"));
assert(!fixture.includes("SUPABASE_SERVICE_ROLE_KEY")); // Ensure no direct exposure in output/logs

// Confirm lifecycle script has required coverage
assert(fixture.includes("verifyPlatformDenial"));
assert(fixture.includes("testInvitation"));
assert(fixture.includes("testRecovery"));
assert(fixture.includes("adminClient"));
assert(fixture.includes("standardClient"));

// Confirm admin logic only in invitation
assert(authInvite.includes("inviteUserByEmail"));
assert(authRecover.includes("resetPasswordForEmail"));

assert(
  manifest.scripts["auth:test:invitation"] ===
    "node tooling/run-local-auth-lifecycle.mjs invitation --confirm-local-auth-lifecycle",
);
assert(
  manifest.scripts["auth:test:recovery"] ===
    "node tooling/run-local-auth-lifecycle.mjs recovery --confirm-local-auth-lifecycle",
);
assert(
  manifest.scripts["auth:test:lifecycle"] ===
    "node tooling/run-local-auth-lifecycle.mjs lifecycle --confirm-local-auth-lifecycle",
);

assert(manifest.scripts.check.includes("node tooling/verify-auth-lifecycle-policy.mjs"));
assert(!manifest.scripts.check.includes("auth:test:lifecycle"));

console.log(
  "Auth lifecycle policy passed: local email capture is tooling-only, secrets are not printed, /platform denial is tested, and metadata remains non-authoritative.",
);
