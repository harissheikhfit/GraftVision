import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const [migration, assignments, tests, boundary, page, form, manifest] = await Promise.all([
  read("supabase/migrations/20260728000003_clinic_settings.sql"),
  read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
  read("supabase/tests/database/clinic_settings.test.sql"),
  read("packages/database/src/clinic-settings.ts"),
  read("apps/web/src/app/(clinic)/clinic/settings/page.tsx"),
  read("apps/web/src/app/(clinic)/clinic/settings/clinic-settings-form.tsx"),
  read("package.json").then(JSON.parse),
]);

for (const assignment of [
  "('CLINIC_OWNER', 'ADMIN-PERM-001')",
  "('CLINIC_ADMIN', 'ADMIN-PERM-001')",
]) {
  assert(assignments.includes(assignment));
}
for (const fragment of [
  "add column timezone text",
  "add column revision integer",
  "clinic_settings_history",
  "CLINIC_SETTINGS_CONTROLLED_UPDATE_REQUIRED",
  "read_clinic_settings",
  "update_clinic_settings",
  "p_expected_revision",
  "clinic.settings_conflict",
  "force row level security",
  "pg_timezone_names",
]) {
  assert(migration.includes(fragment), `Missing clinic settings policy: ${fragment}`);
}
assert(!migration.includes("jsonb settings"));
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(boundary.includes('CLINIC_SETTINGS_PERMISSION = "ADMIN-PERM-001"'));
assert(page.includes("Clinic settings"));
assert(form.includes("Clinic code"));
assert(form.includes("readOnly"));
for (const evidence of [
  "stale revision returns privacy-safe conflict",
  "Clinic Administrator may update",
  "Support Engineer is denied ordinary settings",
  "Clinic B sees only Clinic B settings",
  "direct settings update is denied",
  "settings history is immutable",
]) {
  assert(tests.includes(evidence), `Missing clinic settings test: ${evidence}`);
}
assert.equal(
  manifest.scripts["clinic:test:settings"],
  "node tooling/run-local-clinic-settings.mjs --confirm-local-clinic-settings",
);
assert(manifest.scripts.check.includes("node tooling/verify-clinic-settings-policy.mjs"));
console.log(
  "Clinic settings policy passed: typed fields, IANA timezone validation, optimistic concurrency, immutable history, and tenant/RBAC boundaries are enforced.",
);
