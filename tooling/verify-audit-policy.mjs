import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (
      entry.isDirectory() &&
      ![".next", ".turbo", "coverage", "dist", "node_modules"].includes(entry.name)
    ) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

const migrationNames = (await readdir(path.join(rootDirectory, "supabase/migrations"))).filter(
  (name) => name.endsWith(".sql"),
);
assert.equal(
  migrationNames.length,
  96,
  "AUDIT-001 remains one migration within the current tenant, audit, session, RBAC, planning, AI-MAP, reconstruction, and scalp-region set.",
);

const auditMigrationName = migrationNames.find((name) => name.includes("audit_foundation"));
assert(auditMigrationName, "The AUDIT-001 migration must exist.");

const [
  migration,
  auditSource,
  metadataSource,
  typesSource,
  auditIndex,
  auditTests,
  databaseIndex,
  databaseManifest,
  auditDatabaseTests,
  tenantDatabaseTests,
  rootManifest,
  rootReadme,
  databaseReadme,
  supabaseReadme,
] = await Promise.all([
  read(`supabase/migrations/${auditMigrationName}`),
  read("packages/database/src/audit/audit-event.ts"),
  read("packages/database/src/audit/audit-metadata.ts"),
  read("packages/database/src/audit/audit-types.ts"),
  read("packages/database/src/audit/index.ts"),
  read("packages/database/src/audit/audit-event.test.ts"),
  read("packages/database/src/index.ts"),
  read("packages/database/package.json").then(JSON.parse),
  read("supabase/tests/database/audit_foundation.test.sql"),
  read("supabase/tests/database/tenant_isolation.test.sql"),
  read("package.json").then(JSON.parse),
  read("README.md"),
  read("packages/database/README.md"),
  read("supabase/README.md"),
]);

assert(migration.toLowerCase().includes("task: audit-001"));
assert(/create table public\.audit_event\b/iu.test(migration));
assert(/id uuid primary key default gen_random_uuid\(\)/iu.test(migration));
assert(
  /occurred_at timestamptz not null default timezone\('utc', statement_timestamp\(\)\)/iu.test(
    migration,
  ),
);
assert(/alter table public\.audit_event\s+enable row level security/iu.test(migration));
assert(/alter table public\.audit_event\s+force row level security/iu.test(migration));
assert.equal(
  (migration.match(/create policy[\s\S]*?audit_event/giu) ?? []).length,
  0,
  "AUDIT-001 selects no normal audit read or write policies.",
);
assert(
  /revoke all on table public\.audit_event from public, anon, authenticated/iu.test(migration),
);
assert(
  !/grant\s+[\s\S]*?\s+on table public\.audit_event\s+to\s+(?:anon|authenticated)/iu.test(
    migration,
  ),
);

for (const functionName of ["write_clinic_audit_event", "write_platform_system_audit_event"]) {
  assert(
    new RegExp(
      `create function graftvision_private\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      "iu",
    ).test(migration),
    `${functionName} must be security definer with a pinned empty search path.`,
  );
  assert(
    new RegExp(
      `revoke all on function graftvision_private\\.${functionName}[\\s\\S]*?from public, anon, authenticated`,
      "iu",
    ).test(migration),
    `${functionName} must not be executable by normal roles.`,
  );
}

assert(/create trigger audit_event_prevent_mutation\s+before update or delete/iu.test(migration));
assert(migration.includes("audit events are immutable"));
assert(migration.includes("octet_length(convert_to(candidate::text, 'UTF8')) > 2048"));
assert(migration.includes("jsonb_typeof(candidate) <> 'object'"));
assert(migration.includes("else\n        return false;"));
assert(!/\bexecute\s+format\b|\bdynamic sql\b/iu.test(migration));
assert(!/\busing\s*\(\s*true\s*\)/iu.test(migration));

for (const requiredColumn of [
  "audit_scope",
  "clinic_id",
  "actor_platform_user_id",
  "actor_type",
  "actor_role_snapshot",
  "action",
  "resource_type",
  "resource_id",
  "outcome",
  "reason_code",
  "request_id",
  "source_application",
  "metadata",
]) {
  assert(migration.includes(requiredColumn), `audit_event must include ${requiredColumn}.`);
}

for (const prohibitedTable of [
  "patient",
  "consultation",
  "media",
  "report",
  "procedure",
  "follow_up",
  "support_access",
  "export",
  "deletion",
]) {
  assert(
    !new RegExp(`create table\\s+(?:public\\.)?${prohibitedTable}\\b`, "iu").test(migration),
    `${prohibitedTable} is outside AUDIT-001 scope.`,
  );
}

for (const source of [auditSource, metadataSource, typesSource, auditIndex]) {
  assert(source.startsWith('import "server-only";'));
}
assert.equal(databaseManifest.exports["./audit"].import, "./src/audit/index.ts");
assert(databaseIndex.includes('export * from "./audit";'));
assert(auditSource.includes("TenantTransaction"));
assert(auditSource.includes("$1::text") && auditSource.includes("$8::jsonb"));
assert(!auditSource.includes("clinicId"));
assert(!auditSource.includes("actorPlatformUserId"));
assert(!auditSource.includes("createDatabasePool"));
assert(metadataSource.includes("AUDIT_METADATA_MAX_BYTES"));
assert(typesSource.includes("AUDIT_METADATA_MAX_BYTES = 2048"));

for (const sensitiveKey of [
  "password",
  "secret",
  "token",
  "credential",
  "email",
  "phone",
  "patient_name",
  "medical_history",
  "notes",
  "report_content",
  "file_content",
  "signed_url",
  "database_url",
  "stack",
]) {
  assert(
    auditTests.includes(`"${sensitiveKey}"`),
    `Unit tests must reject sensitive metadata key ${sensitiveKey}.`,
  );
}

for (const requiredDatabaseTest of [
  "audit_event exists",
  "RLS enabled",
  "RLS forced",
  "cannot insert",
  "cannot be updated",
  "cannot be deleted",
  "cannot read",
  "missing tenant context",
  "missing actor context",
  "cross-clinic",
  "suspended membership",
  "oversized metadata",
  "sensitive-looking metadata",
  "generated by the database",
  "opaque UUID",
  "immutable",
  "second event",
  "rolls back its audit event",
  "platform-scoped event",
]) {
  assert(
    auditDatabaseTests.toLowerCase().includes(requiredDatabaseTest.toLowerCase()),
    `Missing audit pgTAP coverage: ${requiredDatabaseTest}.`,
  );
}
assert(tenantDatabaseTests.includes("Clinic Alpha") && tenantDatabaseTests.includes("Clinic Beta"));

assert.equal(rootManifest.scripts["verify:audit-policy"], "node tooling/verify-audit-policy.mjs");
assert(rootManifest.scripts.check.includes("node tooling/verify-audit-policy.mjs"));
assert.equal(
  rootManifest.scripts["db:test:audit"],
  "supabase test db supabase/tests/database/audit_foundation.test.sql",
);

assert(rootReadme.includes("## Append-Only Audit Foundation"));
assert(databaseReadme.includes("## Append-only audit foundation"));
assert(supabaseReadme.includes("## AUDIT-001 append-only audit foundation"));

const applicationFiles = [
  ...(await listFiles(path.join(rootDirectory, "apps"))),
  ...(await listFiles(path.join(rootDirectory, "packages/ui"))),
].filter((file) => /\.(?:js|mjs|ts|tsx)$/u.test(file));

for (const file of applicationFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(rootDirectory, file);

  assert(
    !/@graftvision\/database\/audit/u.test(source),
    `${relative}: audit writes are server-only.`,
  );
  assert(
    !/audit_event|write_clinic_audit_event/iu.test(source),
    `${relative}: no audit SQL, route, or product UI is permitted.`,
  );
}

const appPaths = applicationFiles.map((file) => path.relative(rootDirectory, file).toLowerCase());
assert(
  appPaths.every((file) => !file.includes("/audit")),
  "AUDIT-001 must not add an audit route or screen.",
);

for (const dependency of ["@supabase/supabase-js", "@supabase/ssr", "@supabase/storage-js"]) {
  const allDependencies = {
    ...databaseManifest.dependencies,
    ...databaseManifest.devDependencies,
    ...rootManifest.dependencies,
    ...rootManifest.devDependencies,
  };
  assert(!Object.hasOwn(allDependencies, dependency), `${dependency} remains outside scope.`);
}

console.log(
  "Audit policy passed: append-only events use trusted context, controlled metadata, owner-only writes, deny-all normal reads, safe server boundaries, and no product or clinical scope.",
);
