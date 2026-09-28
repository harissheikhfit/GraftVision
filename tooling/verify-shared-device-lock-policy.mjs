import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
  migration,
  databaseTest,
  registry,
  reauthentication,
  proxy,
  activityBoundary,
  lockedContent,
  mfa,
  auditTypes,
  manifest,
] = await Promise.all([
  read("supabase/migrations/20260728000000_shared_device_lock.sql"),
  read("supabase/tests/database/shared_device_lock.test.sql"),
  read("packages/auth/src/server/registry.ts"),
  read("packages/auth/src/server/reauthentication.ts"),
  read("packages/auth/src/server/proxy.ts"),
  read("apps/web/src/app/session-activity-boundary.tsx"),
  read("apps/web/src/app/(public)/locked/locked-session-content.tsx"),
  read("packages/auth/src/server/mfa.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("package.json").then(JSON.parse),
]);

const migrations = (await readdir(path.join(root, "supabase/migrations"))).filter((file) =>
  file.endsWith(".sql"),
);
assert.equal(migrations.length, 81);

for (const fragment of [
  "add column locked_at timestamptz",
  "add column lock_reason_code text",
  "add column reauthenticated_at timestamptz",
  "lock_application_session",
  "unlock_application_session",
  "record_session_reauthentication_failed",
  "logout_locked_application_session",
  "record_application_session_activity",
  "interval '30 minutes'",
  "'session.lock'",
  "'session.unlock'",
  "'session.reauthentication_failed'",
  "'session.logout_after_lock'",
]) {
  assert(migration.includes(fragment), `Shared-device lock migration is missing ${fragment}.`);
}

assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(registry.includes('reasonCode: "IDLE"'));
assert(registry.includes("getCurrentApplicationSessionState"));
assert(reauthentication.includes("signInWithPassword"));
assert(reauthentication.includes("recordCurrentSessionReauthenticationFailed"));
assert(reauthentication.includes("terminateLockedSession"));
assert(proxy.includes('lockUrl.pathname = "/locked"'));

assert(activityBoundary.includes("25 * 60 * 1000"));
assert(activityBoundary.includes("30 * 60 * 1000"));
assert(activityBoundary.includes("document.visibilityState"));
assert(activityBoundary.includes('event.type === "keydown"'));
assert(activityBoundary.includes('event.type === "pointerdown"'));
for (const prohibitedActivity of [
  "setInterval(record",
  'visibilitychange", listener',
  "mousemove",
]) {
  assert(!activityBoundary.includes(prohibitedActivity));
}

assert(lockedContent.includes('autoComplete="current-password"'));
assert(lockedContent.includes("Protected content remains hidden"));
assert(!lockedContent.match(/clinicId|platformUserId|role|permission|verification/u));

assert(mfa.includes("MfaCapabilityProvider"));
assert(mfa.includes("data.totp"));
assert(!mfa.includes(".enroll("));
assert(!mfa.toLowerCase().includes("sms"));

for (const action of [
  '"session.lock"',
  '"session.unlock"',
  '"session.reauthentication_failed"',
  '"session.logout_after_lock"',
]) {
  assert(auditTypes.includes(action));
}

for (const requiredTest of [
  "warning threshold does not lock before thirty minutes",
  "database time automatically locks after thirty idle minutes",
  "clinic session cannot unlock into platform scope",
  "cross-tenant clinic context cannot unlock",
  "combined Doctor role never changes clinic scope",
  "normal locked reads do not duplicate lock audit events",
]) {
  assert(
    databaseTest.includes(requiredTest),
    `Shared-device test coverage is missing ${requiredTest}.`,
  );
}

await assert.rejects(access(path.join(root, "apps/web/src/app/api/session/renew/route.ts")));
assert.equal(
  manifest.scripts["auth:test:shared-device-lock"],
  "node tooling/run-local-session-registry.mjs --confirm-local-session-registry",
);
assert.equal(
  manifest.scripts["verify:shared-device-lock-policy"],
  "node tooling/verify-shared-device-lock-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-shared-device-lock-policy.mjs"));

console.log(
  "Shared-device lock policy passed: server-owned lock state, password reauthentication, privacy-safe rendering, activity exclusions, and MFA readiness are enforced.",
);
