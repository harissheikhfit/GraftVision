import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const applications = ["present", "scan", "web"];
const supportedTemplateKeys = new Set([
  "APP_ENV",
  "APPLICATION_SESSION_SIGNING_KEY",
  "ENABLE_REAL_RECONSTRUCTION",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NODE_ENV",
  "RECONSTRUCTION_ENGINE_EXECUTABLE",
  "RECONSTRUCTION_ENGINE_REQUIRED_VERSION",
  "RECONSTRUCTION_ENGINE_TIMEOUT_MS",
  "RECONSTRUCTION_MAX_OUTPUT_BYTES",
  "RECONSTRUCTION_TEMP_DIRECTORY",
  "SESSION_ABSOLUTE_TIMEOUT_HOURS",
  "SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS",
  "SESSION_CLOCK_SKEW_SECONDS",
  "SESSION_IDLE_TIMEOUT_MINUTES",
  "SESSION_IDLE_WARNING_MINUTES",
  "SUPABASE_DB_URL",
]);
const allowedRawEnvironmentFiles = new Set([
  "packages/config/src/env/admin.ts",
  "packages/config/src/env/auth.ts",
  "packages/config/src/env/client.ts",
  "packages/config/src/env/database.ts",
  "packages/config/src/env/server.ts",
  "packages/config/src/env/session.ts",
  "packages/database/src/real-reconstruction-engine.ts",
]);
const allowedPrivateProviderFiles = new Set([
  "packages/auth/src/server/admin.ts",
  "packages/config/src/env/admin.ts",
]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const prohibitedProviderPattern =
  /\b(?:SUPABASE_(?:ACCESS_TOKEN|ANON_KEY|PROJECT_REF|SECRET_KEY|SERVICE_ROLE_KEY|URL)|AUTH0|CLERK|RESEND|TWILIO|WHATSAPP|OPENAI|ANTHROPIC|SENTRY|VERCEL|CLOUDFLARE|TURBO_TOKEN)(?:_[A-Z0-9]+)*\b/u;

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (
      entry.isDirectory() &&
      !["coverage", "dist", "node_modules", ".next"].includes(entry.name)
    ) {
      files.push(...(await listSourceFiles(entryPath)));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const [
  template,
  gitignore,
  rootManifest,
  turboConfiguration,
  clientSource,
  serverSource,
  databaseSource,
  authSource,
  sessionSource,
] = await Promise.all([
  read(".env.example"),
  read(".gitignore"),
  JSON.parse(await read("package.json")),
  JSON.parse(await read("turbo.json")),
  read("packages/config/src/env/client.ts"),
  read("packages/config/src/env/server.ts"),
  read("packages/config/src/env/database.ts"),
  read("packages/config/src/env/auth.ts"),
  read("packages/config/src/env/session.ts"),
]);

const templateEntries = template
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    assert(match, `.env.example contains an invalid assignment: ${line}`);
    return { key: match[1], value: match[2] };
  });

assert.deepEqual(
  new Set(templateEntries.map(({ key }) => key)),
  supportedTemplateKeys,
  ".env.example keys must match the currently supported foundational variables.",
);

for (const { key, value } of templateEntries) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    assert(
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"].includes(key),
      `${key}: public variable is not approved`,
    );
  }
  assert(value !== "", `${key}: the copyable local template requires an explicit safe value`);
  assert(
    !/(?:secret|token|password|private[_-]?key)/iu.test(value),
    `${key}: template value resembles a secret`,
  );
  assert(!prohibitedProviderPattern.test(key), `${key}: unapproved provider variable`);
  assert(
    serverSource.includes(key) ||
      databaseSource.includes(key) ||
      clientSource.includes(key) ||
      sessionSource.includes(key),
    `${key}: template key is absent from the approved schemas`,
  );
}

assert(template.includes("NEXT_PUBLIC_"), "The template must explain the public prefix policy.");
assert(template.includes("Provider credentials belong to later approved tasks."));
assert(
  template.includes("SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
  "The template must contain only the known local Supabase PostgreSQL connection.",
);
assert(clientSource.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
assert(clientSource.includes("NEXT_PUBLIC_SUPABASE_URL"));
assert(authSource.startsWith('import "server-only";'));
assert(authSource.includes("must use a loopback host"));
assert(authSource.includes("cannot use local values"));
assert(serverSource.startsWith('import "server-only";'));
assert(serverSource.includes('["local", "test", "staging", "production"]'));
assert(serverSource.includes("is required when NODE_ENV is production"));
assert(databaseSource.startsWith('import "server-only";'));
assert(databaseSource.includes("SUPABASE_DB_URL"));
assert(databaseSource.includes("must use a loopback host"));
assert(databaseSource.includes("cannot use local credentials"));

for (const requiredIgnore of [".env", ".env.*", "!.env.example"]) {
  assert(gitignore.includes(requiredIgnore), `.gitignore must contain ${requiredIgnore}`);
}

assert.equal(Object.hasOwn(turboConfiguration, "globalEnv"), false);
assert.equal(Object.hasOwn(turboConfiguration, "globalPassThroughEnv"), false);
assert.deepEqual(turboConfiguration.tasks.test.env, ["CI", "NODE_ENV"]);
assert.deepEqual(turboConfiguration.tasks["test:coverage"].env, ["CI", "NODE_ENV"]);

for (const application of applications) {
  const applicationTurbo = JSON.parse(await read(`apps/${application}/turbo.json`));
  const expected =
    application === "web"
      ? [
          "APP_ENV",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_URL",
          "NODE_ENV",
          "SUPABASE_DB_URL",
        ]
      : ["NODE_ENV"];
  assert.deepEqual(
    applicationTurbo.tasks.build.env,
    expected,
    `${application}: build environment allowlist drifted`,
  );
}

const sourceFiles = [
  ...(await listSourceFiles(path.join(rootDirectory, "apps"))),
  ...(await listSourceFiles(path.join(rootDirectory, "packages"))),
];

for (const filePath of sourceFiles) {
  const relativePath = normalisePath(path.relative(rootDirectory, filePath));
  const source = await readFile(filePath, "utf8");

  if (source.includes("process.env")) {
    assert(
      allowedRawEnvironmentFiles.has(relativePath),
      `${relativePath}: raw process.env access is outside the approved configuration boundary`,
    );
  }

  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relativePath)) {
    assert(
      allowedPrivateProviderFiles.has(relativePath) || !prohibitedProviderPattern.test(source),
      `${relativePath}: private provider variable`,
    );
  }
}

assert.equal(
  rootManifest.scripts["verify:env-policy"],
  "node tooling/verify-env-policy.mjs",
  "The environment verifier script must remain directly runnable.",
);

console.log(
  "Environment policy is valid: local Auth uses allowlisted public values and a server-only admin boundary; database and private provider credentials remain outside client code.",
);
