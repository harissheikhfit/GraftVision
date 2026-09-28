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
  74,
  "The approved storage-key contract remains present in the current additive migration set.",
);

const [
  storageSource,
  storageIndex,
  storageTests,
  databaseIndex,
  databaseManifest,
  rootManifest,
  rootReadme,
  databaseReadme,
  supabaseReadme,
  supabaseConfig,
  migrations,
] = await Promise.all([
  read("packages/database/src/storage/storage-key.ts"),
  read("packages/database/src/storage/index.ts"),
  read("packages/database/src/storage/storage-key.test.ts"),
  read("packages/database/src/index.ts"),
  read("packages/database/package.json").then(JSON.parse),
  read("package.json").then(JSON.parse),
  read("README.md"),
  read("packages/database/README.md"),
  read("supabase/README.md"),
  read("supabase/config.toml"),
  Promise.all(migrationNames.map((name) => read(`supabase/migrations/${name}`))),
]);

assert(storageSource.startsWith('import "server-only";'));
assert(storageIndex.startsWith('import "server-only";'));
assert.equal(databaseManifest.exports["./storage"].import, "./src/storage/index.ts");
assert(databaseIndex.includes('export * from "./storage";'));

for (const requiredBucket of [
  'clinicBrandingPrivate: "clinic-branding-private"',
  'clinicalPrivate: "clinical-private"',
  'platformPrivate: "platform-private"',
  'transferPrivate: "transfer-private"',
]) {
  assert(storageSource.includes(requiredBucket), `Missing proposed bucket: ${requiredBucket}.`);
}

for (const requiredNamespace of [
  "consultations",
  "surgery-assessments",
  "procedures",
  "follow-ups",
  "reports",
  "presentations",
  "exports",
  "clinic-assets",
  "temporary",
  "quarantine",
  "rejected",
]) {
  assert(
    storageSource.includes(`"${requiredNamespace}"`) ||
      storageSource.includes(`"${requiredNamespace}",`),
    `Missing storage namespace ${requiredNamespace}.`,
  );
}

for (const requiredObjectClass of [
  "clinical-image-original",
  "clinical-image-derivative",
  "clinical-video-original",
  "model-original",
  "model-derivative",
  "model-screenshot",
  "report-internal",
  "report-patient-safe",
  "report-support",
  "presentation-safe",
  "export",
  "thumbnail",
  "ai-input",
  "ai-output",
  "comparison-output",
  "clinic-branding",
]) {
  assert(storageSource.includes(`"${requiredObjectClass}"`));
}

for (const requiredExport of [
  "buildClinicAssetKey",
  "buildExportKey",
  "buildPatientAssetKey",
  "buildPlatformAssetKey",
  "buildQuarantineKey",
  "buildRejectedKey",
  "buildTemporaryUploadKey",
  "parseStorageKey",
  "parseFinalStorageKey",
  "validateStorageKey",
  "isClinicScopedKey",
  "assertStorageKeyBelongsToClinic",
  "getStorageObjectClass",
]) {
  assert(storageIndex.includes(requiredExport), `Missing storage export ${requiredExport}.`);
}

for (const requiredProtection of [
  'key.includes("//")',
  'key.includes("\\\\")',
  'key.includes("%")',
  'key.includes("?")',
  'key.includes("#")',
  'key.startsWith("/")',
  "codePoint <= 31",
  'segment === ".."',
  "STORAGE_TENANT_MISMATCH",
]) {
  assert(
    storageSource.includes(requiredProtection),
    `Missing key protection ${requiredProtection}.`,
  );
}

assert(!/\b(?:fileName|filename|originalName|originalFilename)\b/u.test(storageSource));
assert(
  !/@supabase\/|aws-sdk|cloudflare|createBucket|createSigned|signedUrl|signedURL/iu.test(
    storageSource,
  ),
);
assert(!/\.(?:upload|download|remove|move|copy|list)\s*\(/u.test(storageSource));
assert(!/storage\.(?:from|createBucket|getBucket|updateBucket)/u.test(storageSource));

for (const requiredTest of [
  "round-trips every supported key shape",
  "rejects a clinic mismatch",
  "does not parse temporary or quarantine objects as final assets",
  "uses deterministic generated fixtures",
  "never uses a user filename",
  "keeps internal and patient-safe report classes separate",
]) {
  assert(storageTests.includes(requiredTest), `Missing test coverage: ${requiredTest}.`);
}

assert(
  rootManifest.scripts["verify:storage-key-policy"] ===
    "node tooling/verify-storage-key-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-storage-key-policy.mjs"));
assert(rootReadme.includes("## Private Storage-Key Contract"));
assert(databaseReadme.includes("## Private storage-key contract"));
assert(supabaseReadme.includes("## Proposed private bucket strategy"));
assert(supabaseConfig.includes("[storage]\nenabled = true"));

for (const [index, migration] of migrations.entries()) {
  if (
    migrationNames[index] !== "20260728000004_clinic_branding.sql" &&
    migrationNames[index] !== "20260801000006_scan_media_upload.sql"
  ) {
    assert(!/\bstorage\.(?:buckets|objects)\b|create policy[^;]*storage/iu.test(migration));
  }
  const prohibitedStorageScope =
    migrationNames[index] === "20260728000006_patient_foundation.sql"
      ? /\bcreate table\s+(?:public\.)?(?:media|consultation|procedure|report|scan|presentation|model)\b/iu
      : migrationNames[index] === "20260729000006_consultation_foundation.sql"
        ? /\bcreate table\s+(?:public\.)?(?:media|procedure|report|scan|presentation|model)\b/iu
        : /\bcreate table\s+(?:public\.)?(?:media|patient|consultation|procedure|report|scan|presentation|model)\b/iu;
  assert(!prohibitedStorageScope.test(migration));
}

const applicationFiles = [
  ...(await listFiles(path.join(rootDirectory, "apps"))),
  ...(await listFiles(path.join(rootDirectory, "packages/ui"))),
].filter((file) => /\.(?:js|mjs|ts|tsx)$/u.test(file));

for (const file of applicationFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(rootDirectory, file);

  assert(
    !/@graftvision\/database\/storage/u.test(source),
    `${relative}: applications and UI must not construct storage keys.`,
  );
  assert(
    !/(?:clinics|temporary|quarantine|rejected)\/\$\{/u.test(source),
    `${relative}: raw storage-key construction is prohibited.`,
  );
  assert(!/@supabase\/supabase-js/u.test(source), `${relative}: provider SDK is deferred.`);
}

for (const dependency of [
  "@aws-sdk/client-s3",
  "@aws-sdk/s3-request-presigner",
  "@supabase/storage-js",
  "@supabase/supabase-js",
]) {
  const allDependencies = {
    ...databaseManifest.dependencies,
    ...databaseManifest.devDependencies,
    ...rootManifest.dependencies,
    ...rootManifest.devDependencies,
  };
  assert(!Object.hasOwn(allDependencies, dependency), `${dependency} is outside DB-003 scope.`);
}

console.log(
  "Storage-key policy passed: keys remain controlled, tenant-prefixed, traversal-safe, report/lifecycle separated, and the bounded clinic-branding bucket is private.",
);
