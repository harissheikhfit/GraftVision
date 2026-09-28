import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
  inventoryTests,
  proxyTests,
  handlerTests,
  actionTests,
  proxy,
  revokeOne,
  revokeAll,
  registry,
  auditTests,
  auditTypes,
  rbacAuthorityTests,
  rbacBoundaryTests,
  doctorTests,
  lockTests,
  manifest,
] = await Promise.all([
  read("apps/web/src/app/auth-protection.test.ts"),
  read("packages/auth/src/server/proxy.test.ts"),
  read("apps/web/src/app/auth-protection.test.ts"),
  read("apps/web/src/app/(public)/locked/actions.test.ts"),
  read("packages/auth/src/server/proxy.ts"),
  read("apps/web/src/app/api/session/revoke/route.ts"),
  read("apps/web/src/app/api/session/revoke-all/route.ts"),
  read("packages/auth/src/server/registry.ts"),
  read("packages/database/src/audit/audit-event.test.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("supabase/tests/database/rbac_authority.test.sql"),
  read("supabase/tests/database/rbac_boundary.test.sql"),
  read("supabase/tests/database/doctor_authority.test.sql"),
  read("supabase/tests/database/shared_device_lock.test.sql"),
  read("package.json").then(JSON.parse),
]);

const routeFiles = [];
async function collectRoutes(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      await collectRoutes(path.join(directory, entry.name), relative);
    } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
      routeFiles.push(relative);
    }
  }
}
await collectRoutes(path.join(root, "apps/web/src/app"));
routeFiles.sort();
const databaseTestDirectory = path.join(root, "supabase/tests/database");
const databaseTestCorpus = (
  await Promise.all(
    (await readdir(databaseTestDirectory))
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFile(path.join(databaseTestDirectory, file), "utf8")),
  )
)
  .join("\n")
  .toLowerCase();

for (const routeFile of routeFiles) {
  assert(
    inventoryTests.includes(`"${routeFile}"`),
    `Current Web route is absent from the AUTH-005 inventory test: ${routeFile}`,
  );
}
assert(inventoryTests.includes("proxy matcher exactly"));
assert(proxy.includes('request.nextUrl.pathname.startsWith("/clinic")'));
assert(proxy.includes('request.nextUrl.pathname.startsWith("/platform")'));

for (const boundary of [
  "denies wrong-scope access",
  "forged provider/application-session identity",
  "every locked clinic or platform session",
  "existing authority shell",
  "unauthenticated protected requests",
]) {
  assert(proxyTests.includes(boundary), `Protected-shell matrix is missing ${boundary}.`);
}

for (const handler of [revokeOne, revokeAll]) {
  assert(handler.includes('request.headers.get("origin")'));
  assert(handler.includes("createRequestAuthClient"));
  assert(handler.includes("client.auth.getUser"));
  assert(handler.includes("AUTH_SESSION_REQUIRED"));
}
assert(revokeOne.includes("terminateOtherSession(body.sessionId, data.user.id)"));
assert(revokeAll.includes("terminateAllOtherSessions(data.user.id)"));
assert(registry.includes("currentSession.platformUserId === providerIdentityId"));

for (const coverage of [
  "cross-origin and missing-origin direct calls",
  "unauthenticated provider access",
  "matching provider boundary",
  "does not expose submitted values",
]) {
  assert(handlerTests.includes(coverage), `Session handler tests are missing ${coverage}.`);
}
for (const coverage of [
  "revalidated %s authority shell",
  "without calling the reauthentication boundary",
  "generic public redirect when reauthentication fails",
  "matching locked session",
  "forged or unlocked application context",
]) {
  assert(actionTests.includes(coverage), `Server Action tests are missing ${coverage}.`);
}

for (const coverage of ["Exactly 13 approved roles", "Exactly 60 approved permissions"]) {
  assert(rbacAuthorityTests.includes(coverage), `RBAC regression is missing ${coverage}.`);
}
for (const coverage of [
  "platform session is denied clinic data",
  "clinic session is denied platform administration",
  "combined-role user succeeds only in the matching clinic session",
  "Clinic A session is denied Clinic B",
  "support engineer is denied tenant and clinical data",
]) {
  assert(rbacBoundaryTests.includes(coverage), `Scope regression is missing ${coverage}.`);
}
for (const coverage of [
  "pending verification grants no doctor authority",
  "database time denies expired verification immediately",
  "revocation immediately denies the previously valid doctor session",
]) {
  assert(doctorTests.toLowerCase().includes(coverage), `Doctor regression is missing ${coverage}.`);
}
for (const coverage of [
  "database time automatically locks",
  "clinic session cannot unlock into platform scope",
  "cross-tenant clinic context cannot unlock",
]) {
  assert(lockTests.includes(coverage), `Lock regression is missing ${coverage}.`);
}
for (const coverage of [
  "platform-user deactivation",
  "inactive clinic",
  "membership suspension",
  "role change invalidates",
  "does not restore stale sessions",
]) {
  assert(
    databaseTestCorpus.includes(coverage),
    `Session propagation regression is missing ${coverage}.`,
  );
}

for (const action of [
  "authority.cross_scope_denied",
  "authority.scope_change",
  "doctor.verification.expired",
  "doctor.verification.revoked",
  "session.lock",
  "session.reauthentication_failed",
  "session.revoke_authorization_change",
  "session.revoke_inactive_membership",
  "session.revoke_inactive_user",
  "session.unlock",
]) {
  assert(auditTypes.includes(`"${action}"`), `Audit matrix is missing ${action}.`);
}
for (const prohibitedMetadata of [
  "password",
  "token",
  "cookie",
  "otp",
  "patient_name",
  "raw_request_body",
  "full_user_agent",
  "unrestricted_notes",
]) {
  assert(
    auditTests.includes(`"${prohibitedMetadata}"`),
    `Sensitive-data exclusion test is missing ${prohibitedMetadata}.`,
  );
}

for (const lowRiskHandler of [
  read("apps/web/src/app/api/session/activity/route.ts"),
  read("apps/web/src/app/api/session/lock/route.ts"),
  Promise.resolve(revokeOne),
  Promise.resolve(revokeAll),
]) {
  const source = await lowRiskHandler;
  assert(!source.includes("writeAuditEvent"), "Route denials must not create ad-hoc audit events.");
}

assert.equal(
  manifest.scripts["verify:auth-protection-policy"],
  "node tooling/verify-auth-protection-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-auth-protection-policy.mjs"));

console.log(
  `Auth protection policy passed: ${routeFiles.length} current Web routes inventoried; route, direct-call, session, tenant, RBAC, Doctor, lock, audit, and sensitive-data boundaries are covered.`,
);
