import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisionRelativePath = "decisions/ADR-001-DEVELOPMENT-PROVIDER-FOUNDATION.md";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`GraftVision provider policy verifier

Usage:
  corepack pnpm verify:provider-policy

Verifies the approved local-only Supabase PostgreSQL and Auth foundation while
remote linkage, private provider credentials, Storage, and Realtime remain absent.`);
  process.exit(0);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (
      entry.isDirectory() &&
      !["node_modules", ".next", "dist", "coverage"].includes(entry.name)
    ) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

const [decision, readme, template, rootManifest, databaseManifest, authManifest, config] =
  await Promise.all([
    readFile(path.join(rootDirectory, decisionRelativePath), "utf8"),
    readFile(path.join(rootDirectory, "README.md"), "utf8"),
    readFile(path.join(rootDirectory, ".env.example"), "utf8"),
    readFile(path.join(rootDirectory, "package.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDirectory, "packages/database/package.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDirectory, "packages/auth/package.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDirectory, "supabase/config.toml"), "utf8"),
  ]);

for (const requiredDecisionText of [
  "Option A — Integrated Supabase foundation",
  "Supabase-managed PostgreSQL",
  "Supabase Auth",
  "Supabase Storage",
  "Supabase Realtime",
  "Realtime is a delivery mechanism, never the source of truth",
]) {
  assert(
    decision.includes(requiredDecisionText),
    `${decisionRelativePath} lost its provider decision.`,
  );
}

assert(readme.includes("Supabase Auth"));
assert.equal(rootManifest.devDependencies.supabase, "2.109.1");
assert.equal(databaseManifest.dependencies.pg, "8.22.0");
assert.equal(databaseManifest.dependencies["@graftvision/config"], "workspace:*");
assert(!Object.hasOwn(rootManifest.dependencies ?? {}, "supabase"));

const manifestPaths = [
  "apps/present/package.json",
  "apps/scan/package.json",
  "apps/web/package.json",
  "packages/auth/package.json",
  "packages/config/package.json",
  "packages/types/package.json",
  "packages/ui/package.json",
];

for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(path.join(rootDirectory, manifestPath), "utf8"));
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  assert(
    !Object.hasOwn(dependencies, "pg"),
    `${manifestPath}: pg belongs only in packages/database.`,
  );
  assert(
    !Object.hasOwn(dependencies, "supabase"),
    `${manifestPath}: the Supabase CLI belongs only in the root development dependencies.`,
  );
}

assert.equal(authManifest.dependencies["@supabase/ssr"], "0.12.3");
assert.equal(authManifest.dependencies["@supabase/supabase-js"], "2.110.8");
assert(!Object.hasOwn(databaseManifest.dependencies, "@supabase/ssr"));
assert(!Object.hasOwn(databaseManifest.dependencies, "@supabase/supabase-js"));

for (const prohibitedVariable of [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
]) {
  assert(
    !new RegExp(`^\\s*${prohibitedVariable}\\s*=`, "mu").test(template),
    `.env.example must not configure ${prohibitedVariable}.`,
  );
}
assert(template.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"));
assert(template.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="));

assert(
  template.includes("SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
);
assert(config.includes('project_id = "graftvision-local"'));

assert(/\[api\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(/\[auth\][\s\S]*?enabled\s*=\s*true/u.test(config));
assert(/\[auth\][\s\S]*?enable_signup\s*=\s*false/u.test(config));
for (const service of ["realtime", "studio", "analytics", "edge_runtime"]) {
  assert(
    new RegExp(`\\[${service}\\][\\s\\S]*?enabled\\s*=\\s*false`, "u").test(config),
    `supabase/config.toml must keep ${service} disabled.`,
  );
}
assert(/\[storage\][\s\S]*?enabled\s*=\s*true/u.test(config));

try {
  await access(path.join(rootDirectory, "supabase/.temp/project-ref"));
  assert.fail("The local project must not be linked to a remote Supabase project.");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

const implementationFiles = [
  ...(await listFiles(path.join(rootDirectory, "apps"))),
  ...(await listFiles(path.join(rootDirectory, "packages"))),
].filter((candidate) => /\.(?:js|mjs|ts|tsx)$/u.test(candidate));

for (const file of implementationFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(rootDirectory, file);

  if (!relative.startsWith(`packages${path.sep}auth${path.sep}`)) {
    assert(!/@supabase\//u.test(source), `${relative}: provider SDK crossed the Auth boundary.`);
  }
  assert(!/\bsupabase\.channel\b/u.test(source), `${relative}: unapproved service.`);
  if (/\bsupabase\.storage\b/u.test(source) || /\.storage\.from\(/u.test(source)) {
    assert.equal(
      relative,
      `packages${path.sep}auth${path.sep}src${path.sep}server${path.sep}private-storage.ts`,
      `${relative}: Storage use must remain inside the reviewed private server adapter.`,
    );
  }
  assert(
    !/\b(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\s*=/u.test(source),
    `${relative}: private provider key assignment.`,
  );
}

console.log(
  "Provider policy passed: Supabase SDK use is isolated to packages/auth; private clinic-branding Storage is server-owned, while remote linkage and Realtime remain absent.",
);
