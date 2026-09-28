import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const [migration, assignments, tests, boundary, storage, actions, form, manifest, config] =
  await Promise.all([
    read("supabase/migrations/20260728000004_clinic_branding.sql"),
    read("supabase/migrations/20260727000001_rbac_authority_hardening.sql"),
    read("supabase/tests/database/clinic_branding.test.sql"),
    read("packages/database/src/clinic-branding.ts"),
    read("packages/auth/src/server/private-storage.ts"),
    read("apps/web/src/app/(clinic)/clinic/settings/branding/actions.ts"),
    read("apps/web/src/app/(clinic)/clinic/settings/branding/clinic-branding-form.tsx"),
    read("package.json").then(JSON.parse),
    read("supabase/config.toml"),
  ]);

assert(migrationNames.includes("20260728000004_clinic_branding.sql"));
assert.equal(migrationNames.length, 81);
for (const assignment of [
  "('CLINIC_OWNER', 'ADMIN-PERM-001')",
  "('CLINIC_ADMIN', 'ADMIN-PERM-001')",
]) {
  assert(assignments.includes(assignment));
}
for (const fragment of [
  "clinic_branding",
  "clinic_branding_history",
  "clinic-branding-private",
  "file_size_limit",
  "force row level security",
  "CLINIC_BRANDING_CONTROLLED_UPDATE_REQUIRED",
  "create_default_clinic_branding",
  "has_clinic_branding_authority",
  "read_clinic_branding",
  "update_clinic_branding",
  "p_expected_revision",
  "clinic.branding_conflict",
  "clinic.branding_update",
  "clinic.branding_view",
]) {
  assert(migration.includes(fragment), `Missing clinic branding policy: ${fragment}`);
}
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(!migration.includes("jsonb settings"));
assert(!migration.match(/\b(mfa|billing|patient|support access|impersonation)\b/iu));
assert(boundary.includes('CLINIC_BRANDING_PERMISSION = "ADMIN-PERM-001"'));
assert(boundary.includes("CLINIC_BRANDING_MAX_BYTES = 2_097_152"));
assert(boundary.includes("CLINIC_BRANDING_MIN_DIMENSION = 256"));
assert(boundary.includes("CLINIC_BRANDING_MAX_DIMENSION = 2048"));
assert(boundary.includes("validateClinicLogo"));
assert(boundary.includes("isSafeClinicBrandAccent"));
assert(storage.includes(".createSignedUrl("));
assert(storage.includes("upsert: false"));
assert(actions.includes('requireVerifiedAuthSession(authClient, "clinic")'));
assert(actions.includes("removePrivateClinicBrandingObject"));
assert(form.includes('aria-label="Clinic shell preview"'));
assert(form.includes('aria-label="Report header preview"'));
assert(form.includes('aria-label="Presentation title preview"'));
assert(!form.match(/\b(generate report|start presentation|custom css|custom font)\b/iu));
assert(config.includes("[storage]\nenabled = true"));
for (const evidence of [
  "Clinic Administrator may update and remove logo",
  "Support Engineer is denied ordinary branding",
  "Clinic A cannot read Clinic B branding",
  "locked session is denied",
  "branding history is immutable",
  "database stores no raw logo bytes",
]) {
  assert(tests.includes(evidence), `Missing clinic branding test: ${evidence}`);
}
assert.equal(
  manifest.scripts["clinic:test:branding"],
  "node tooling/run-local-clinic-branding.mjs --confirm-local-clinic-branding",
);
assert.equal(
  manifest.scripts["verify:clinic-branding-policy"],
  "node tooling/verify-clinic-branding-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-clinic-branding-policy.mjs"));
console.log(
  "Clinic branding policy passed: private bounded logos, protected accents, optimistic concurrency, immutable history, previews, and tenant/RBAC boundaries are enforced.",
);
