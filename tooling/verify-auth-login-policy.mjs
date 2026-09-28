import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const exists = async (relativePath) => {
  try {
    await read(relativePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const [
  manifest,
  authManifest,
  config,
  template,
  authReadme,
  login,
  clinic,
  platform,
  proxy,
  fixture,
  loginIdentity,
  currentUser,
  loginTests,
  platformAdminTests,
] = await Promise.all([
  read("package.json").then(JSON.parse),
  read("packages/auth/package.json").then(JSON.parse),
  read("supabase/config.toml"),
  read(".env.example"),
  read("packages/auth/README.md"),
  read("apps/web/src/app/(public)/login/actions.ts"),
  read("apps/web/src/app/(clinic)/clinic/page.tsx"),
  read("apps/web/src/app/(platform)/platform/page.tsx"),
  read("apps/web/src/proxy.ts"),
  read("tooling/run-local-auth-fixtures.mjs"),
  read("packages/database/src/auth-identity.ts"),
  read("packages/auth/src/server/current-user.ts"),
  read("apps/web/src/app/(public)/login/actions.test.ts"),
  read("supabase/tests/database/platform_admin.test.sql"),
]);

assert.equal(authManifest.dependencies["@supabase/ssr"], "0.12.3");
assert.equal(authManifest.dependencies["@supabase/supabase-js"], "2.110.8");
assert(!JSON.stringify(authManifest).includes("@supabase/auth-helpers-nextjs"));
assert(authReadme.includes("2026-07-26") && authReadme.includes("Deprecated auth-helper"));

assert(/\[api\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(/\[auth\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(/\[auth\][\s\S]*?enable_signup\s*=\s*false/u.test(config));
for (const service of ["storage", "realtime", "studio", "analytics", "edge_runtime"]) {
  assert(new RegExp(`\\[${service}\\][\\s\\S]*?enabled\\s*=\\s*false`, "u").test(config));
}

assert(template.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"));
assert(template.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="));
for (const privateKey of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) {
  assert(!template.includes(`${privateKey}=`));
}

assert(login.includes("signInWithPassword"));
assert(login.includes("AUTH_INVALID_CREDENTIALS"));
assert(login.includes("getLoginUser"));
assert(login.includes("selectLoginAuthority"));
assert(login.includes("authority.authorityScope"));
assert(!login.includes('formData.get("scope")'));
assert(!login.includes('formData.get("next")'));
assert(loginIdentity.includes("platform_role.role_code = 'PLATFORM_OWNER'"));
assert(loginIdentity.includes("role.role_type = 'clinic'"));
assert(loginIdentity.includes("'session.create'"));
assert(loginIdentity.includes("LOGIN_INACTIVE_USER"));
assert(loginIdentity.includes("LOGIN_SCOPE_UNAVAILABLE"));
assert(currentUser.includes('authorityScope: "platform", destination: "/platform"'));
assert(currentUser.includes('authorityScope: "clinic"'));
assert(loginTests.includes("bootstrap-only Platform Owner"));
assert(loginTests.includes("ignores forged browser scope"));
assert(platformAdminTests.includes("platform login creates no implicit clinic membership"));
assert(platformAdminTests.includes("bootstrap-only owner cannot forge clinic scope"));
assert(clinic.includes("getCurrentUser") && clinic.includes('redirect("/login")'));
assert(
  platform.includes('requireVerifiedAuthSession(client, "platform")') &&
    platform.includes("readPlatformDashboard") &&
    !platform.includes("patient"),
);
assert(proxy.includes("refreshAuthSession"));
assert(!login.includes("console.") && !login.includes("searchParams"));

for (const absentRoute of ["register", "signup", "forgot-password", "recover", "oauth"]) {
  assert(!(await exists(`apps/web/src/app/${absentRoute}/page.tsx`)));
}
for (const app of ["scan", "present"]) {
  const files = await readdir(path.join(root, `apps/${app}/src`), { recursive: true });
  assert(!files.some((file) => /(?:login|auth)/iu.test(String(file))));
}

for (const forbidden of [
  "signUp(",
  "resetPassword",
  "signInWithOAuth",
  "localStorage",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  assert(!login.includes(forbidden));
}
assert(fixture.includes("--confirm-local-auth-fixtures"));
assert(fixture.includes('project_id = "graftvision-local"'));
assert(fixture.includes("127.0.0.1") && fixture.includes("54321") && fixture.includes("54322"));
assert.equal((fixture.match(/example\.test/gu) ?? []).length, 6);
assert(!fixture.includes("console.log(fixturePassword"));

const migrations = (await readdir(path.join(root, "supabase/migrations"))).filter((file) =>
  file.endsWith(".sql"),
);
assert.equal(migrations.length, 81);
assert.equal(
  manifest.scripts["auth:seed:local"],
  "node tooling/run-local-auth-fixtures.mjs seed --confirm-local-auth-fixtures",
);
assert(manifest.scripts.check.includes("node tooling/verify-auth-login-policy.mjs"));

console.log(
  "Auth login policy passed: provider login is server-managed, Platform Owners receive explicit platform scope, clinic-only login is preserved, browser scope is ignored, and no implicit tenant access is created.",
);
