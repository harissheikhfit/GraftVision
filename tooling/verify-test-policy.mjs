import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireCoverage = process.argv.includes("--require-coverage");

const workspaces = [
  { environment: "jsdom", name: "@graftvision/present", relativeRoot: "apps/present" },
  { environment: "jsdom", name: "@graftvision/scan", relativeRoot: "apps/scan" },
  { environment: "jsdom", name: "@graftvision/web", relativeRoot: "apps/web" },
  { environment: "node", name: "@graftvision/auth", relativeRoot: "packages/auth" },
  { environment: "node", name: "@graftvision/config", relativeRoot: "packages/config" },
  { environment: "node", name: "@graftvision/database", relativeRoot: "packages/database" },
  { environment: "node", name: "@graftvision/types", relativeRoot: "packages/types" },
  { environment: "jsdom", name: "@graftvision/ui", relativeRoot: "packages/ui" },
];

const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const primaryTestFilePattern = /\.test\.[cm]?[jt]sx?$/u;
const prohibitedNetworkImportPattern =
  /(?:from\s+|import\s*\(\s*)["'](?:node:)?(?:dgram|http|https|net|tls)["']/u;
const focusedOrSkippedTestPattern = /\b(?:describe|it|test)\s*\.\s*(?:only|skip|todo)\s*\(/u;
const unsafeExternalUrlPattern =
  /https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\]|[A-Za-z0-9.-]*\.example\.test)\b)[^\s"'`)]+/gu;
const realLookingEmailPattern =
  /\b[A-Z0-9._%+-]+@(?!(?:example\.test|[A-Z0-9.-]*\.example\.test)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;

async function listTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const testFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      testFiles.push(...(await listTestFiles(entryPath)));
    } else if (entry.isFile() && testFilePattern.test(entry.name)) {
      testFiles.push(entryPath);
    }
  }

  return testFiles;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const violations = [];
const enumeration = [];

for (const workspace of workspaces) {
  const workspaceRoot = path.join(rootDirectory, workspace.relativeRoot);
  const manifest = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8"));
  const requiredScripts = {
    test: "vitest run",
    "test:coverage": "vitest run",
    "test:watch": "vitest",
  };

  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    const script = manifest.scripts?.[scriptName];

    if (typeof script !== "string" || !script.includes(expectedCommand)) {
      violations.push(
        `${workspace.relativeRoot}/package.json: ${scriptName} must use ${expectedCommand}`,
      );
    }
  }

  const sourceDirectory = path.join(workspaceRoot, "src");
  const testFiles = await listTestFiles(sourceDirectory);
  enumeration.push(
    `${workspace.name}: ${testFiles.length} test file(s), ${workspace.environment} environment`,
  );

  for (const testFile of testFiles) {
    const relativeFile = path.relative(rootDirectory, testFile).split(path.sep).join("/");
    const source = await readFile(testFile, "utf8");

    if (!primaryTestFilePattern.test(testFile)) {
      violations.push(`${relativeFile}: use the primary *.test.ts or *.test.tsx convention`);
    }

    if (focusedOrSkippedTestPattern.test(source)) {
      violations.push(`${relativeFile}: focused, skipped, or todo tests are not allowed`);
    }

    if (prohibitedNetworkImportPattern.test(source)) {
      violations.push(`${relativeFile}: direct network modules are prohibited in unit tests`);
    }

    const unsafeUrls = source.match(unsafeExternalUrlPattern) ?? [];

    for (const unsafeUrl of unsafeUrls) {
      violations.push(`${relativeFile}: external URL "${unsafeUrl}" is not synthetic`);
    }

    const realLookingEmails = source.match(realLookingEmailPattern) ?? [];

    for (const email of realLookingEmails) {
      violations.push(`${relativeFile}: email "${email}" must use the .example.test domain`);
    }
  }

  if (requireCoverage) {
    const requiredCoverageFiles = [
      "coverage/coverage-summary.json",
      "coverage/index.html",
      "coverage/lcov.info",
    ];

    for (const relativeCoverageFile of requiredCoverageFiles) {
      if (!(await fileExists(path.join(workspaceRoot, relativeCoverageFile)))) {
        violations.push(
          `${workspace.relativeRoot}/${relativeCoverageFile}: expected coverage output is missing`,
        );
      }
    }
  }
}

const rootManifest = JSON.parse(await readFile(path.join(rootDirectory, "package.json"), "utf8"));
const vitestConfiguration = await readFile(path.join(rootDirectory, "vitest.config.ts"), "utf8");
const isolationSetup = await readFile(
  path.join(rootDirectory, "testing/setup-isolation.ts"),
  "utf8",
);

for (const requiredRootScript of ["test", "test:coverage", "test:watch", "verify:test-policy"]) {
  if (typeof rootManifest.scripts?.[requiredRootScript] !== "string") {
    violations.push(`package.json: missing root ${requiredRootScript} script`);
  }
}

for (const requiredConfigurationText of [
  'provider: "v8"',
  '"jsdom"',
  '"node"',
  "passWithNoTests: true",
  "restoreMocks: true",
  "unstubEnvs: true",
  "unstubGlobals: true",
]) {
  if (!vitestConfiguration.includes(requiredConfigurationText)) {
    violations.push(`vitest.config.ts: missing required policy ${requiredConfigurationText}`);
  }
}

if (!isolationSetup.includes('vi.stubGlobal("fetch"')) {
  violations.push("testing/setup-isolation.ts: fetch must be blocked by default");
}

console.log("Workspace test enumeration:");

for (const workspaceSummary of enumeration) {
  console.log(`- ${workspaceSummary}`);
}

if (violations.length > 0) {
  console.error("Test-policy verification failed:");

  for (const violation of violations) {
    console.error(`- ${violation}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    requireCoverage
      ? "Test configuration, isolation, synthetic-data rules, and coverage outputs are valid."
      : "Test configuration, isolation, and synthetic-data rules are valid.",
  );
}
