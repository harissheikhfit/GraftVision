import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".next", ".turbo", "coverage", "dist", "node_modules"]);
const allowedBoundarySqlFiles = new Set(["packages/auth/src/server/rbac.ts"]);
const historicalMigrations = new Map([
  [
    "20260726081606_tenant_foundation.sql",
    "f088fdb8ebd0b22a8223e5a1385b7514b0387ed4ba113ebd04439666b93248e4",
  ],
  [
    "20260726143000_audit_foundation.sql",
    "626622b6c9a6e54371a7669427ce9361a500601dab00914684fd281abf338a1f",
  ],
  [
    "20260726152000_tenant_policy_families.sql",
    "aa843da153661acf13eda0e9d81f52bae368be319ccb14149d7a7daaff23d769",
  ],
]);

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function requireFragments(source, fragments, category) {
  for (const fragment of fragments) {
    assert(
      source.toLowerCase().includes(fragment.toLowerCase()),
      `${category} is missing: ${fragment}.`,
    );
  }
}

const migrationNames = (await readdir(path.join(rootDirectory, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert.deepEqual(
  migrationNames.slice(0, historicalMigrations.size),
  [...historicalMigrations.keys()],
  "TENANT-004 historical migrations must remain ordered and unchanged.",
);
assert.equal(
  migrationNames.length,
  78,
  "The current migration set must contain seventy-eight migrations.",
);

for (const [name, expectedHash] of historicalMigrations) {
  const source = await read(`supabase/migrations/${name}`);
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    expectedHash,
    `${name} changed after approval.`,
  );
}

const [
  regression,
  tenantTests,
  tenantFamilyTests,
  auditTests,
  seedTests,
  poolHarness,
  serverTests,
  tenantPackageTests,
  storageTests,
  rootManifest,
  databaseManifest,
  rootReadme,
  databaseReadme,
  supabaseReadme,
] = await Promise.all([
  read("supabase/tests/database/tenant_regression.test.sql"),
  read("supabase/tests/database/tenant_isolation.test.sql"),
  read("supabase/tests/database/tenant_policy_families.test.sql"),
  read("supabase/tests/database/audit_foundation.test.sql"),
  read("supabase/tests/database/synthetic_seed_foundation.test.sql"),
  read("tooling/run-tenant-pool-regression.mjs"),
  read("packages/database/src/server.test.ts"),
  read("packages/database/src/tenant/tenant-context.test.ts"),
  read("packages/database/src/storage/storage-key.test.ts"),
  read("package.json").then(JSON.parse),
  read("packages/database/package.json").then(JSON.parse),
  read("README.md"),
  read("packages/database/README.md"),
  read("supabase/README.md"),
]);

assert(regression.includes("begin;") && regression.includes("rollback;"));
assert(regression.includes("select plan(62);"));
assert(!/create table\s+public\./iu.test(regression));
assert(regression.includes("create schema tenant_regression_fixture"));

requireFragments(
  regression,
  [
    "missing clinic context",
    "missing actor context",
    "invalid actor context",
    "unknown actor context",
    "unknown clinic context",
    "wrong-clinic context",
    "Alpha Owner sees Clinic Alpha",
    "Alpha Owner never reads Clinic Beta",
    "Beta Owner sees Clinic Beta",
    "Beta Owner never reads Clinic Alpha",
    "suspended membership",
    "missing membership",
    "inactive platform user",
    "inactive clinic",
    "duplicate membership",
    "ordinary users cannot self-create memberships",
    "ordinary users cannot change membership status",
    "ordinary users cannot move a membership",
    "same actor and clinic context reuse is safe",
    "trusted context cannot switch clinics",
    "trusted context cannot switch actors",
    "savepoint failure preserves the original valid context",
    "ordinary callers cannot clear and replace protected context",
    "same-clinic parent-child relationship succeeds",
    "cross-clinic parent-child relationship fails",
    "clinic ownership cannot change",
    "parent deletion remains restrictive",
    "tenant-scoped code may repeat",
    "tenant-scoped code cannot repeat",
    "composite parent relationship index",
    "RLS remains enabled",
    "RLS remains forced",
    "persistent tenant policies contain no broad true predicate",
    "tenant security helpers pin a safe search path",
    "authenticated role cannot establish trusted tenant context",
    "unauthenticated role has no tenant-table access",
    "normal role cannot disable RLS",
    "normal role cannot change tenant policies",
    "valid audit event accepts trusted Alpha context",
    "audit clinic and actor derive from trusted Alpha context",
    "failed protected transaction leaves no audit evidence",
    "ordinary user cannot read audit rows",
    "ordinary user cannot mutate audit rows",
    "audit metadata protections remain active",
    "synthetic fixture counts remain deterministic",
    "all deterministic synthetic identities use example.test",
    "synthetic seed has no unexpected membership",
    "migration history includes the current foundation migrations",
  ],
  "Tenant regression coverage",
);

requireFragments(
  regression,
  [
    "negative control detects a table without forced RLS",
    "negative control detects a broad select policy",
    "negative control detects a weakened cross-clinic foreign key",
    "negative control proves a status-blind membership lookup is insecure",
    "approved membership predicate rejects the same suspended fixture",
  ],
  "Negative-control coverage",
);

assert(tenantTests.includes("select plan(27);"));
assert(tenantFamilyTests.includes("select plan(29);"));
assert(auditTests.includes("select plan(47);"));
assert(seedTests.includes("select plan(36);"));

requireFragments(
  poolHarness,
  [
    "max: 1",
    "max: 2",
    '"commit"',
    '"rollback"',
    "synthetic protected operation failed",
    "Promise.all",
    "assertContextCleared",
    "queryAsAuthenticated",
    "set local role authenticated",
    "reset role",
    "write_clinic_audit_event",
    "Rolled-back concurrent transactions left audit evidence",
    "Pool regression is permitted only in local or disposable test environments",
    "Pool regression requires a loopback host",
    "The explicit local pool-regression confirmation is missing",
  ],
  "Pool regression harness",
);
assert(!/console\.(?:log|error)\([^)]*(?:connectionString|SUPABASE_DB_URL)/u.test(poolHarness));

requireFragments(
  serverTests,
  [
    "establishes fresh context for sequential pool operations",
    "graftvision_private.set_tenant_context",
    "rolls back",
    "redacts database details",
  ],
  "Database server tests",
);
requireFragments(
  tenantPackageTests,
  ["same-context reuse", "cross-clinic nested context", "audit writer composable"],
  "Tenant package tests",
);
requireFragments(
  storageTests,
  [
    "asserts matching clinic ownership",
    "rejects a clinic mismatch without revealing either tenant identifier",
    "does not treat a platform key as clinic owned",
    "does not parse temporary or quarantine objects as final assets",
    "keeps internal and patient-safe report classes separate",
    "never uses a user filename as a generated key",
    "deterministic generated fixtures to reject unsafe segments",
    "builds a request-scoped export key",
  ],
  "Storage-key tests",
);

assert.equal(rootManifest.scripts["db:test:all"], "supabase test db");
assert.equal(
  rootManifest.scripts["db:test:tenant-regression"],
  "supabase test db supabase/tests/database/tenant_regression.test.sql",
);
assert.equal(
  rootManifest.scripts["db:test:pool-regression"],
  "node tooling/run-tenant-pool-regression.mjs --confirm-local-tenant-regression",
);
assert.equal(
  rootManifest.scripts["verify:tenant-regression-policy"],
  "node tooling/verify-tenant-regression-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-tenant-regression-policy.mjs"));
assert(!rootManifest.scripts.check.includes("db:test:tenant-regression"));
assert(!rootManifest.scripts.check.includes("db:test:pool-regression"));

assert(rootReadme.includes("## Tenant Isolation Regression Gate"));
assert(databaseReadme.includes("## Tenant regression guarantees"));
assert(supabaseReadme.includes("## TENANT-004 tenant isolation regression"));

const migrationSources = await Promise.all(
  migrationNames.map((name) => read(`supabase/migrations/${name}`)),
);
const actualTables = (
  migrationSources
    .join("\n")
    .match(/\bcreate table\s+(?:if not exists\s+)?public\.([a-z0-9_]+)\b/giu) ?? []
).map((t) => t.replace(/create table\s+(?:if not exists\s+)?public\./iu, ""));

const expectedTables = [
  "platform_user",
  "clinic",
  "clinic_membership",
  "audit_event",
  "application_session",
  "role_definition",
  "permission_definition",
  "role_permission",
  "platform_user_role",
  "clinic_membership_role",
  "doctor_verification",
  "doctor_verification_evidence",
  "doctor_verification_history",
  "clinic_status_history",
  "clinic_invitation",
  "clinic_invitation_role",
  "clinic_invitation_history",
  "clinic_staff_management_history",
  "clinic_settings_history",
  "clinic_branding",
  "clinic_branding_history",
  "clinic_onboarding_readiness",
  "clinic_onboarding_attestation",
  "clinic_onboarding_attestation_history",
  "clinic_onboarding_readiness_history",
  "clinic_patient_counter",
  "patient",
  "patient_status_history",
  "patient_creation_idempotency",
  "patient_registration",
  "patient_registration_history",
  "patient_duplicate_decision_history",
  "patient_registration_idempotency",
  "privacy_notice_version",
  "patient_privacy_acknowledgement",
  "patient_privacy_acknowledgement_history",
  "patient_privacy_acknowledgement_idempotency",
  "patient_lifecycle_history",
  "patient_lifecycle_idempotency",
  "platform_admin_history",
  "platform_operational_history",
  "consultation",
  "consultation_assignment",
  "consultation_status_history",
  "consultation_assignment_history",
  "consultation_operation_idempotency",
  "patient_medical_history",
  "patient_medical_history_version",
  "consultation_hair_loss_history",
  "consultation_hair_loss_history_version",
  "consultation_history_binding",
  "clinical_history_change_event",
  "clinical_history_review_event",
  "doctor_private_note",
  "doctor_private_note_version",
  "clinical_operation_idempotency",
  "preliminary_assessment",
  "preliminary_assessment_version",
  "preliminary_assessment_event",
  "consultation_lifecycle_event",
  "scan_session",
  "scan_session_event",
  "scan_operation_idempotency",
  "scan_capture_state",
  "scan_capture_event",
  "scan_capture_asset",
  "scan_capture_upload_event",
  "scan_capture_upload_idempotency",
  "scan_capture_quality_event",
  "scan_capture_quality_current",
  "scan_capture_quality_idempotency",
  "scan_capture_quality_retake_idempotency",
  "scan_capture_quality_override_idempotency",
  "scan_capture_quality_result",
  "scan_capture_quality_review",
  "scan_analyzer_handoff",
  "scan_analyzer_handoff_idempotency",
  "reconstruction_input_manifest",
  "reconstruction_job",
  "reconstruction_job_event",
  "reconstruction_job_idempotency",
  "reconstruction_prepared_asset",
  "reconstruction_prepared_manifest",
  "reconstruction_preparation_event",
  "reconstruction_preparation_idempotency",
  "reconstruction_artifact",
  "reconstruction_artifact_geometry",
  "reconstruction_worker_storage_grant",
  "scalp_model_package",
  "reconstruction_output_manifest",
  "reconstruction_output_event",
  "reconstruction_output_idempotency",
  "model_annotation_package",
  "model_annotation_event",
  "model_annotation_idempotency",
  "model_annotation_landmark_current",
  "model_annotation_landmark_version",
  "model_annotation_curve_current",
  "model_annotation_curve_version",
  "model_annotation_region_current",
  "model_annotation_region_version",
  "model_annotation_ai_provenance",
  "ai_map_proposal_package",
  "ai_map_proposal_event",
  "ai_map_proposal_idempotency",
  "ai_map_proposal_asset_binding",
  "ai_map_proposal_landmark",
  "ai_map_proposal_curve",
  "ai_map_proposal_region",
  "ai_map_proposal_decision",
  "planning_package",
  "planning_idempotency",
  "scalp_region",
  "scalp_region_version",
  "scalp_region_geometry",
  "scalp_region_idempotency",
];

assert.deepEqual(
  actualTables.sort(),
  expectedTables.sort(),
  "Only the exact approved tenant, audit, session, RBAC, Doctor-authority, clinic, patient, platform-admin, consultation, scan-capture, planning, and scalp-region tables may exist.",
);

for (const table of [
  "patient",
  "consultation",
  "media",
  "report",
  "procedure",
  "follow_up",
  "subscription",
  "support_access",
  "export",
  "deletion",
]) {
  assert(
    !new RegExp(`create table\\s+(?:public\\.)?${table}\\b`, "iu").test(regression),
    `${table} fixtures are outside TENANT-004 scope.`,
  );
}

const dependencies = {
  ...rootManifest.dependencies,
  ...rootManifest.devDependencies,
  ...databaseManifest.dependencies,
  ...databaseManifest.devDependencies,
};
for (const dependency of ["@supabase/supabase-js", "@supabase/ssr"]) {
  assert(!Object.hasOwn(dependencies, dependency), `${dependency} remains outside scope.`);
}

const boundaryFiles = (
  await Promise.all(
    ["apps", "packages/auth", "packages/config", "packages/types", "packages/ui"].map((directory) =>
      listFiles(path.join(rootDirectory, directory)),
    ),
  )
)
  .flat()
  .filter(
    (file) => /\.(?:js|mjs|ts|tsx)$/u.test(file) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file),
  );

for (const file of boundaryFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(rootDirectory, file);

  assert(
    allowedBoundarySqlFiles.has(relative) ||
      !/graftvision_private|public\.(?:platform_user|clinic|clinic_membership|audit_event)/iu.test(
        source,
      ),
    `${relative}: direct SQL or tenant-context access bypasses the database package.`,
  );
  assert(
    !/@graftvision\/database\/(?:src|tenant|audit|storage)|@graftvision\/config\/env\/database/iu.test(
      source,
    ),
    `${relative}: application code bypasses an approved package boundary.`,
  );
}

assert(
  !/(?:FACE Aesthetic|Dr Sheraz|Haris Liaqat|@(?:gmail|hotmail|outlook)\.)/iu.test(regression),
  "Regression fixtures must remain synthetic.",
);
assert(!/\b(?:auth\.users|signIn|signUp|jwt)\b/iu.test(regression));

console.log(
  "Tenant regression policy passed: 62 rollback-only SQL assertions, live pool/concurrency " +
    "coverage, negative controls, unchanged migrations, preserved package boundaries, and no " +
    "product, Auth, role, remote, or persistent-fixture scope.",
);
