import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const applications = [
  { name: "@graftvision/present", port: "3002", relativeRoot: "apps/present" },
  { name: "@graftvision/scan", port: "3001", relativeRoot: "apps/scan" },
  { name: "@graftvision/web", port: "3000", relativeRoot: "apps/web" },
];
const sharedPackages = [
  { name: "@graftvision/auth", relativeRoot: "packages/auth" },
  { name: "@graftvision/config", relativeRoot: "packages/config" },
  { name: "@graftvision/database", relativeRoot: "packages/database" },
  { name: "@graftvision/types", relativeRoot: "packages/types" },
  { name: "@graftvision/ui", relativeRoot: "packages/ui" },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(rootDirectory, relativePath), "utf8"));
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

const [rootManifest, turboConfiguration, gitignore] = await Promise.all([
  readJson("package.json"),
  readJson("turbo.json"),
  readFile(path.join(rootDirectory, ".gitignore"), "utf8"),
]);

assert.deepEqual(
  turboConfiguration.globalDependencies,
  ["pnpm-workspace.yaml"],
  "Only workspace resolution should invalidate every Turborepo task globally.",
);
assert.equal(
  Object.hasOwn(turboConfiguration, "globalEnv"),
  false,
  "Environment variables must be scoped to tasks instead of every task hash.",
);
assert.equal(
  Object.hasOwn(turboConfiguration, "globalPassThroughEnv"),
  false,
  "No secret-bearing pass-through variables are required at this foundation stage.",
);
assert.equal(
  Object.hasOwn(turboConfiguration, "remoteCache"),
  false,
  "Remote caching must remain unconfigured.",
);

const tasks = turboConfiguration.tasks;

assert.deepEqual(tasks.build.dependsOn, ["^build"]);
assert.deepEqual(tasks.build.outputs, ["dist/**"]);
assert(tasks.build.inputs.includes("$TURBO_DEFAULT$"));
assert(tasks.build.inputs.includes("$TURBO_ROOT$/tsconfig.base.json"));
assert(tasks.build.inputs.includes("$TURBO_ROOT$/tsconfig.package.json"));
assert(tasks.build.inputs.includes("$TURBO_ROOT$/tsconfig.server.json"));
assert.equal(tasks.build.inputs.includes("$TURBO_ROOT$/tsconfig.tooling.json"), false);
assert(tasks.build.inputs.includes("!README.md"));
assert(tasks.build.inputs.includes("!src/**/*.{test,spec}.{ts,tsx}"));

for (const taskName of ["lint", "test", "typecheck"]) {
  assert.notEqual(tasks[taskName].cache, false, `${taskName} must remain cacheable.`);
  assert.deepEqual(tasks[taskName].outputs, []);
  assert(tasks[taskName].inputs.includes("!README.md"));
}

assert.equal(
  Object.hasOwn(tasks.test, "dependsOn"),
  false,
  "Unit tests must not trigger unrelated prerequisite builds.",
);
assert.deepEqual(tasks.typecheck.dependsOn, ["^typecheck"]);
assert.deepEqual(tasks["test:coverage"].outputs, ["coverage/**"]);
assert.deepEqual(tasks.test.env, ["CI", "NODE_ENV"]);
assert.deepEqual(tasks["test:coverage"].env, ["CI", "NODE_ENV"]);

for (const taskName of ["dev", "test:watch"]) {
  assert.equal(tasks[taskName].cache, false);
  assert.equal(tasks[taskName].persistent, true);
}

assert.equal(tasks.clean.cache, false);
assert.equal(Object.hasOwn(tasks, "format"), false);
assert.equal(Object.hasOwn(tasks, "format:check"), false);
assert.equal(Object.hasOwn(tasks, "lint:fix"), false);
assert.equal(Object.hasOwn(tasks, "check"), false);

for (const application of applications) {
  const [manifest, packageTurboConfiguration] = await Promise.all([
    readJson(`${application.relativeRoot}/package.json`),
    readJson(`${application.relativeRoot}/turbo.json`),
  ]);

  assert.equal(manifest.name, application.name);
  assert.equal(manifest.scripts.build, "next build");
  assert.equal(manifest.scripts.dev, `next dev --port ${application.port}`);
  assert.equal(manifest.scripts.clean, "rimraf .next .turbo coverage tsconfig.tsbuildinfo");
  assert.equal(Object.hasOwn(manifest.scripts, "format:check"), false);
  assert.deepEqual(packageTurboConfiguration.extends, ["//"]);
  assert.deepEqual(
    packageTurboConfiguration.tasks.build.env,
    application.name === "@graftvision/web"
      ? [
          "APP_ENV",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_URL",
          "NODE_ENV",
          "SUPABASE_DB_URL",
        ]
      : ["NODE_ENV"],
  );
  assert.deepEqual(packageTurboConfiguration.tasks.build.inputs, [
    "$TURBO_DEFAULT$",
    "!README.md",
    "!src/**/*.{test,spec}.{ts,tsx}",
    "$TURBO_ROOT$/tsconfig.base.json",
    "$TURBO_ROOT$/tsconfig.next.json",
  ]);
  assert.deepEqual(packageTurboConfiguration.tasks.build.outputs, [".next/**", "!.next/cache/**"]);
}

for (const sharedPackage of sharedPackages) {
  const [manifest, buildConfiguration] = await Promise.all([
    readJson(`${sharedPackage.relativeRoot}/package.json`),
    readJson(`${sharedPackage.relativeRoot}/tsconfig.build.json`),
  ]);

  assert.equal(manifest.name, sharedPackage.name);
  assert.equal(manifest.scripts.build, "rimraf dist && tsc --project tsconfig.build.json");
  assert.equal(manifest.scripts.clean, "rimraf .turbo coverage dist tsconfig.tsbuildinfo");
  assert.equal(Object.hasOwn(manifest.scripts, "format:check"), false);
  assert.equal(buildConfiguration.compilerOptions.declaration, true);
  assert.equal(buildConfiguration.compilerOptions.emitDeclarationOnly, true);
  assert.equal(buildConfiguration.compilerOptions.noEmit, false);
  assert.equal(buildConfiguration.compilerOptions.outDir, "dist");
}

for (const ignoredOutput of [".next/", ".turbo/", "coverage/", "dist/", "*.tsbuildinfo"]) {
  assert(
    gitignore.includes(ignoredOutput),
    `.gitignore must exclude generated output ${ignoredOutput}.`,
  );
}

const rootCleanScript = rootManifest.scripts.clean;

for (const prohibitedCleanTarget of ["docs", ".env", "pnpm-lock.yaml", "package.json", "src"]) {
  assert.equal(
    rootCleanScript.split(/\s+/u).includes(prohibitedCleanTarget),
    false,
    `The root clean command must not target ${prohibitedCleanTarget}.`,
  );
}

assert.equal(
  rootCleanScript.includes("*"),
  false,
  "The root clean command must use explicit paths.",
);

const checkScript = rootManifest.scripts.check;
const orderedCheckSteps = [
  "prettier --check .",
  "turbo run lint",
  "turbo run typecheck",
  "turbo run test",
  "turbo run build",
  "node tooling/verify-boundaries.mjs",
  "node tooling/verify-quality-policy.mjs",
  "node tooling/verify-test-policy.mjs",
  "node tooling/verify-turbo-policy.mjs",
];
let previousIndex = -1;

for (const checkStep of orderedCheckSteps) {
  const currentIndex = checkScript.indexOf(checkStep);
  assert(currentIndex > previousIndex, `pnpm check must run "${checkStep}" in order.`);
  assert.equal(
    countOccurrences(checkScript, checkStep),
    1,
    `pnpm check must run "${checkStep}" exactly once.`,
  );
  previousIndex = currentIndex;
}

assert.equal(checkScript.includes("continue-on-error"), false);
assert.equal(JSON.stringify(turboConfiguration).includes("docs/"), false);
assert.equal(JSON.stringify(turboConfiguration).includes(".env"), false);

console.log(
  "Turborepo policy is valid: eight workspaces, topological builds/typechecks, exact outputs, scoped inputs/environment, uncached persistent tasks, and safe clean targets.",
);
