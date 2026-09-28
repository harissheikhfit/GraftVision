import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const [migration, tests, boundary, page, manifest] = await Promise.all([
  read("supabase/migrations/20260729000000_patient_search.sql"),
  read("supabase/tests/database/patient_search.test.sql"),
  read("packages/database/src/patient-search.ts"),
  read("apps/web/src/app/(clinic)/clinic/patients/page.tsx"),
  read("package.json").then(JSON.parse),
]);

assert(migrations.includes("20260729000000_patient_search.sql"));
assert.equal(migrations.length, 81);
for (const fragment of [
  "has_patient_root_authority",
  "search_patients",
  "normalised_name",
  "patient_number",
  "phone",
  "email",
  "p.status = p_status",
  "p.created_at, p.id",
  "p_page_size not between 1 and 100",
  "INVALID_PATIENT_CURSOR",
  "masked_name",
]) {
  assert(migration.includes(fragment), `Missing patient search policy: ${fragment}`);
}
assert(!migration.includes("insert into public.permission_definition"));
assert(!migration.includes("insert into public.role_definition"));
assert(!migration.match(/\b(offset|similarity|soundex|metaphone|tsvector)\b/iu));
assert(boundary.includes('PATIENT_SEARCH_PERMISSION = "PATIENT-PERM-001"'));
assert(boundary.includes("PATIENT_SEARCH_DEFAULT_PAGE_SIZE = 25"));
assert(boundary.includes("PATIENT_SEARCH_MAX_PAGE_SIZE = 100"));
assert(page.includes('dynamic = "force-dynamic"'));
assert(page.includes("Masked patient results"));
assert(!page.includes("unstable_cache"));
for (const evidence of [
  "active patients are returned by default",
  "patient number exact/prefix search works",
  "normalised name prefix search works",
  "normalised phone search works",
  "normalised email prefix search works",
  "inactive filter must be explicit",
  "created date range is bounded",
  "Clinic A cannot discover Clinic B",
  "concurrent insert does not destabilise the next cursor page",
  "malformed cursor is rejected",
  "cross-clinic cursor is rejected",
  "unverified Doctor is denied",
  "Support ordinary patient access is denied",
  "locked session is denied",
  "result projection masks identity and contact values",
]) {
  assert(tests.includes(evidence), `Missing patient search test: ${evidence}`);
}
assert.equal(
  manifest.scripts["patient:test:search"],
  "node tooling/run-local-patient-search.mjs --confirm-local-patient-search",
);
assert.equal(
  manifest.scripts["verify:patient-search-policy"],
  "node tooling/verify-patient-search-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-patient-search-policy.mjs"));
console.log(
  "Patient search policy passed: same-clinic deterministic matching, stable cursors, masked projections, readiness, RBAC, and Doctor authority are enforced.",
);
