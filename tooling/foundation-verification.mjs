import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const requiredPnpmVersion = "11.17.0";
export const requiredNodeRange = "^22.13.0 || >=24.0.0";
export const temporaryPrefix = "graftvision-foundation-";

export const expectedWorkspaces = [
  {
    kind: "root",
    name: "graftvision",
    relativeRoot: ".",
  },
  {
    kind: "app",
    name: "@graftvision/present",
    port: "3002",
    relativeRoot: "apps/present",
  },
  {
    kind: "app",
    name: "@graftvision/scan",
    port: "3001",
    relativeRoot: "apps/scan",
  },
  {
    kind: "app",
    name: "@graftvision/web",
    port: "3000",
    relativeRoot: "apps/web",
  },
  {
    kind: "package",
    name: "@graftvision/auth",
    relativeRoot: "packages/auth",
  },
  {
    kind: "package",
    name: "@graftvision/config",
    relativeRoot: "packages/config",
  },
  {
    kind: "package",
    name: "@graftvision/database",
    relativeRoot: "packages/database",
  },
  {
    kind: "package",
    name: "@graftvision/types",
    relativeRoot: "packages/types",
  },
  {
    kind: "package",
    name: "@graftvision/ui",
    relativeRoot: "packages/ui",
  },
];

const expectedApplicationScripts = {
  build: "next build",
  clean: "rimraf .next .turbo coverage tsconfig.tsbuildinfo",
  test: "vitest run --config ../../vitest.config.ts --root .",
  "test:coverage": "vitest run --config ../../vitest.config.ts --root . --coverage",
  "test:watch": "vitest --config ../../vitest.config.ts --root .",
  typecheck: "next typegen && tsc --project tsconfig.json --noEmit",
};

const expectedPackageScripts = {
  build: "rimraf dist && tsc --project tsconfig.build.json",
  clean: "rimraf .turbo coverage dist tsconfig.tsbuildinfo",
  test: "vitest run --config ../../vitest.config.ts --root .",
  "test:coverage": "vitest run --config ../../vitest.config.ts --root . --coverage",
  "test:watch": "vitest --config ../../vitest.config.ts --root .",
  typecheck: "tsc --project tsconfig.json --noEmit",
};

const generatedDirectoryNames = new Set([
  ".next",
  ".turbo",
  ".vitest",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);
const ignoredTraversalDirectoryNames = new Set([
  ...generatedDirectoryNames,
  ".git",
  ".idea",
  ".pnpm-store",
  ".tmp",
  ".vscode",
]);
const forbiddenLockfileNames = new Set([
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "yarn.lock",
]);
const forbiddenTrackedNames = new Set([".DS_Store", ".env.local", ".eslintcache", "Thumbs.db"]);
const forbiddenTrackedSuffixes = [".log", ".swp", ".tmp", ".tsbuildinfo"];
const forbiddenDependencyNames = new Set([
  "@ai-sdk/openai",
  "@aws-sdk/client-s3",
  "@clerk/nextjs",
  "@prisma/client",
  "drizzle-orm",
  "openai",
  "prisma",
  "resend",
  "stripe",
  "three",
]);
const forbiddenProviderVariableNames = new Set([
  "AUTH0_CLIENT_SECRET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
]);
const protectedRootFiles = [
  ".editorconfig",
  ".env.example",
  ".gitignore",
  ".npmrc",
  ".prettierignore",
  "CONTRIBUTING.md",
  "README.md",
  "eslint.config.mjs",
  "lint-staged.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "prettier.config.mjs",
  "tsconfig.base.json",
  "tsconfig.next.json",
  "tsconfig.package.json",
  "tsconfig.server.json",
  "tsconfig.tooling.json",
  "turbo.json",
  "vitest.config.ts",
];
const freshCopyRootFiles = [...protectedRootFiles];
const freshCopyRootDirectories = [
  ".husky",
  "apps",
  "decisions",
  "packages",
  "supabase",
  "testing",
  "tooling",
];
const copyExcludedFileNames = new Set([".env", ".env.local"]);
const secretScanExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const protectedDirectoryNames = [
  "apps",
  "decisions",
  "docs",
  "packages",
  "supabase",
  "testing",
  "tooling",
];

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(version.trim());

  if (!match) {
    throw new Error(`Version "${version}" is not a supported semantic version.`);
  }

  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function validateNodeVersion(version) {
  const parsed = parseVersion(version);
  const validNode22 =
    parsed[0] === 22 && compareVersions(parsed, [22, 13, 0]) >= 0 && parsed[0] < 23;
  const validNode24OrLater = parsed[0] >= 24;

  if (!validNode22 && !validNode24OrLater) {
    throw new Error(
      `Node.js ${version} is unsupported. Install Node.js ${requiredNodeRange}, then retry.`,
    );
  }
}

export function validatePnpmVersion(version) {
  if (version.trim() !== requiredPnpmVersion) {
    throw new Error(
      `pnpm ${version.trim()} is unsupported. Run "corepack enable" and ` +
        `"corepack prepare pnpm@${requiredPnpmVersion} --activate".`,
    );
  }
}

export function validateChildResult(result, stepName) {
  if (result.error) {
    throw new Error(`${stepName} could not start: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`${stepName} was terminated by signal ${result.signal}.`);
  }

  if (result.status !== 0) {
    throw new Error(`${stepName} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

export function runCommand(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
  });

  validateChildResult(result, options.stepName ?? `${command} ${argumentsList.join(" ")}`);
  return result;
}

export function runCorepackPnpm(argumentsList, options = {}) {
  const corepackExecutable = process.platform === "win32" ? "corepack.cmd" : "corepack";
  return runCommand(corepackExecutable, ["pnpm", ...argumentsList], options);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listFiles(directory, options = {}) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (
        ignoredTraversalDirectoryNames.has(entry.name) ||
        options.additionalExcludedDirectories?.has(entry.name)
      ) {
        continue;
      }

      files.push(...(await listFiles(entryPath, options)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function validateToolVersions(rootDirectory = repositoryRoot, overrides = {}) {
  const rootManifest = await readJson(path.join(rootDirectory, "package.json"));
  const nodeVersion = overrides.nodeVersion ?? process.version;
  const pnpmVersion =
    overrides.pnpmVersion ??
    runCorepackPnpm(["--version"], {
      capture: true,
      cwd: rootDirectory,
      stepName: "Corepack pnpm version check",
    }).stdout.trim();

  validateNodeVersion(nodeVersion);
  validatePnpmVersion(pnpmVersion);

  if (rootManifest.packageManager !== `pnpm@${requiredPnpmVersion}`) {
    throw new Error(
      `package.json packageManager must be "pnpm@${requiredPnpmVersion}", not ` +
        `"${rootManifest.packageManager ?? "missing"}".`,
    );
  }

  if (rootManifest.engines?.node !== requiredNodeRange) {
    throw new Error(`package.json engines.node must be "${requiredNodeRange}".`);
  }

  if (rootManifest.engines?.pnpm !== requiredPnpmVersion) {
    throw new Error(`package.json engines.pnpm must be "${requiredPnpmVersion}".`);
  }
}

function assertScript(manifest, scriptName, expectedScript, manifestPath) {
  if (manifest.scripts?.[scriptName] !== expectedScript) {
    throw new Error(
      `${manifestPath}: script "${scriptName}" must be "${expectedScript}", not ` +
        `"${manifest.scripts?.[scriptName] ?? "missing"}".`,
    );
  }
}

export async function validateWorkspaceStructure(rootDirectory = repositoryRoot) {
  const names = new Set();
  const manifestsByRoot = new Map();

  for (const workspace of expectedWorkspaces) {
    const manifestPath = path.join(rootDirectory, workspace.relativeRoot, "package.json");

    if (!(await exists(manifestPath))) {
      throw new Error(`${normalisePath(workspace.relativeRoot)}/package.json is missing.`);
    }

    const manifest = await readJson(manifestPath);
    manifestsByRoot.set(workspace.relativeRoot, manifest);

    if (names.has(manifest.name)) {
      throw new Error(`Duplicate workspace package name "${manifest.name}".`);
    }

    names.add(manifest.name);
  }

  for (const workspace of expectedWorkspaces) {
    const manifestPath = path.join(rootDirectory, workspace.relativeRoot, "package.json");
    const manifest = manifestsByRoot.get(workspace.relativeRoot);

    if (manifest.name !== workspace.name) {
      throw new Error(
        `${normalisePath(workspace.relativeRoot)}/package.json must be named ` +
          `"${workspace.name}", not "${manifest.name ?? "missing"}".`,
      );
    }

    if (workspace.kind === "app") {
      for (const [scriptName, expectedScript] of Object.entries(expectedApplicationScripts)) {
        assertScript(manifest, scriptName, expectedScript, manifestPath);
      }

      assertScript(manifest, "dev", `next dev --port ${workspace.port}`, manifestPath);
      assertScript(manifest, "start", `next start --port ${workspace.port}`, manifestPath);
    } else if (workspace.kind === "package") {
      for (const [scriptName, expectedScript] of Object.entries(expectedPackageScripts)) {
        if (workspace.name === "@graftvision/config" && scriptName === "typecheck") {
          continue;
        }

        assertScript(manifest, scriptName, expectedScript, manifestPath);
      }

      if (
        workspace.name === "@graftvision/config" &&
        manifest.scripts?.typecheck !==
          "tsc --project tsconfig.json --noEmit && tsc --project tsconfig.client.json --noEmit"
      ) {
        throw new Error("packages/config/package.json has an unexpected typecheck script.");
      }

      if (
        !manifest.exports ||
        typeof manifest.exports !== "object" ||
        JSON.stringify(manifest.exports).includes('"*"')
      ) {
        throw new Error(
          `${normalisePath(workspace.relativeRoot)}/package.json must use explicit exports.`,
        );
      }
    }
  }

  const manifestFiles = (await listFiles(rootDirectory)).filter(
    (filePath) => path.basename(filePath) === "package.json",
  );
  const expectedManifestPaths = new Set(
    expectedWorkspaces.map((workspace) =>
      path.resolve(rootDirectory, workspace.relativeRoot, "package.json"),
    ),
  );
  const unexpectedManifests = manifestFiles.filter(
    (manifestPath) => !expectedManifestPaths.has(path.resolve(manifestPath)),
  );

  if (unexpectedManifests.length > 0) {
    throw new Error(
      `Unexpected nested workspace manifest(s): ${unexpectedManifests
        .map((manifestPath) => normalisePath(path.relative(rootDirectory, manifestPath)))
        .join(", ")}.`,
    );
  }

  const workspaceConfiguration = await readFile(
    path.join(rootDirectory, "pnpm-workspace.yaml"),
    "utf8",
  );

  if (
    !workspaceConfiguration.includes('  - "apps/*"') ||
    !workspaceConfiguration.includes('  - "packages/*"')
  ) {
    throw new Error("pnpm-workspace.yaml must include only the apps/* and packages/* roots.");
  }
}

function isGeneratedOrHygieneArtifact(relativeFile) {
  const parts = relativeFile.split("/");
  const baseName = parts.at(-1) ?? "";

  return (
    parts.some((part) => generatedDirectoryNames.has(part)) ||
    forbiddenTrackedNames.has(baseName) ||
    forbiddenTrackedSuffixes.some((suffix) => baseName.endsWith(suffix))
  );
}

async function getTrackedFiles(rootDirectory) {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error || result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout.split("\0").filter(Boolean).map(normalisePath);
}

export function scanProviderVariables(source, sourceName = "content") {
  const assignmentPattern = /^\s*([A-Z][A-Z0-9_]*)\s*=/gmu;
  const processEnvironmentPattern = /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/gu;
  const found = new Set();

  for (const pattern of [assignmentPattern, processEnvironmentPattern]) {
    for (const match of source.matchAll(pattern)) {
      const variableName = match[1];

      if (variableName && forbiddenProviderVariableNames.has(variableName)) {
        found.add(variableName);
      }
    }
  }

  if (found.size > 0) {
    throw new Error(`${sourceName}: unapproved provider variable(s): ${[...found].join(", ")}.`);
  }
}

export function scanSecretLikeContent(source, sourceName = "content") {
  const privateKeyMarker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const credentialAssignment = new RegExp(
    String.raw`\b(?:api[_-]?key|client[_-]?secret|password|secret|token)\b\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})`,
    "giu",
  );

  if (source.includes(privateKeyMarker)) {
    throw new Error(`${sourceName}: private-key material is prohibited.`);
  }

  for (const match of source.matchAll(credentialAssignment)) {
    const value = match[1] ?? "";

    if (!/(?:example|placeholder|synthetic|test)/iu.test(value)) {
      throw new Error(`${sourceName}: secret-like credential content is prohibited.`);
    }
  }
}

export async function validateRepositoryHygiene(rootDirectory = repositoryRoot) {
  const files = await listFiles(rootDirectory);
  const relativeFiles = files.map((filePath) =>
    normalisePath(path.relative(rootDirectory, filePath)),
  );
  const lockfiles = relativeFiles.filter((relativeFile) => {
    const baseName = path.posix.basename(relativeFile);
    return baseName === "pnpm-lock.yaml" || forbiddenLockfileNames.has(baseName);
  });

  if (lockfiles.length !== 1 || lockfiles[0] !== "pnpm-lock.yaml") {
    throw new Error(
      `Exactly one root pnpm-lock.yaml is required; found: ${lockfiles.join(", ") || "none"}.`,
    );
  }

  const trackedFiles = await getTrackedFiles(rootDirectory);
  const trackedHygieneViolations = trackedFiles.filter(isGeneratedOrHygieneArtifact);

  if (trackedHygieneViolations.length > 0) {
    throw new Error(
      `Generated or local files must not be tracked: ${trackedHygieneViolations.join(", ")}.`,
    );
  }

  const manifests = expectedWorkspaces.map((workspace) =>
    path.join(rootDirectory, workspace.relativeRoot, "package.json"),
  );

  for (const manifestPath of manifests) {
    const manifest = await readJson(manifestPath);
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ];

    for (const dependencies of dependencySections) {
      for (const dependencyName of Object.keys(dependencies ?? {})) {
        if (forbiddenDependencyNames.has(dependencyName)) {
          throw new Error(
            `${normalisePath(path.relative(rootDirectory, manifestPath))}: unapproved provider or ` +
              `product dependency "${dependencyName}".`,
          );
        }
      }
    }
  }

  const scanFiles = files.filter((filePath) => {
    const relativeFile = normalisePath(path.relative(rootDirectory, filePath));
    const baseName = path.basename(filePath);

    if (
      relativeFile === "pnpm-lock.yaml" ||
      relativeFile === "tooling/foundation-verification.mjs" ||
      relativeFile === "tooling/run-local-auth-fixtures.mjs" ||
      relativeFile === "tooling/verify-foundation-fixtures.mjs" ||
      (baseName.startsWith(".env") && baseName !== ".env.example")
    ) {
      return false;
    }

    return secretScanExtensions.has(path.extname(filePath)) || baseName === ".env.example";
  });

  for (const scanFile of scanFiles) {
    const relativeFile = normalisePath(path.relative(rootDirectory, scanFile));
    const source = await readFile(scanFile, "utf8");
    scanProviderVariables(source, relativeFile);
    scanSecretLikeContent(source, relativeFile);
  }

  const gitignore = await readFile(path.join(rootDirectory, ".gitignore"), "utf8");

  for (const requiredIgnore of [
    ".env.*",
    "!.env.example",
    ".next/",
    ".turbo/",
    "coverage/",
    "dist/",
    "*.log",
    "*.swp",
    ".DS_Store",
  ]) {
    if (!gitignore.includes(requiredIgnore)) {
      throw new Error(`.gitignore must include "${requiredIgnore}".`);
    }
  }
}

const allowedCleanTargets = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "tsconfig.tsbuildinfo",
]);
const protectedCleanTerms = new Set([
  ".env",
  ".env.example",
  ".git",
  "CONTRIBUTING.md",
  "README.md",
  "apps",
  "docs",
  "package.json",
  "packages",
  "pnpm-lock.yaml",
  "src",
]);

export function validateCleanScript(script, sourceName = "clean script") {
  if (/[*?[\]{}$`]/u.test(script)) {
    throw new Error(`${sourceName}: broad patterns or shell expansion are prohibited.`);
  }

  const tokens = script
    .split(/\s+/u)
    .map((token) => token.replaceAll("\\", "/").replace(/^[./]+/u, ""))
    .filter(Boolean);

  for (const token of tokens) {
    const baseName = path.posix.basename(token);

    if (protectedCleanTerms.has(token) || protectedCleanTerms.has(baseName)) {
      throw new Error(`${sourceName}: unsafe cleanup target "${token}".`);
    }

    if (
      token.includes("/") &&
      (token.startsWith("apps/") || token.startsWith("packages/")) &&
      !allowedCleanTargets.has(baseName)
    ) {
      throw new Error(`${sourceName}: non-generated cleanup target "${token}".`);
    }
  }
}

export async function validateCleanupSafety(rootDirectory = repositoryRoot) {
  for (const workspace of expectedWorkspaces) {
    const manifest = await readJson(
      path.join(rootDirectory, workspace.relativeRoot, "package.json"),
    );
    const cleanScript = manifest.scripts?.clean;

    if (typeof cleanScript !== "string") {
      throw new Error(`${workspace.relativeRoot}/package.json: clean script is missing.`);
    }

    validateCleanScript(cleanScript, `${workspace.relativeRoot}/package.json clean`);
  }
}

function shouldExcludeFromFreshCopy(sourcePath, rootDirectory) {
  const relativePath = normalisePath(path.relative(rootDirectory, sourcePath));
  const parts = relativePath.split("/");
  const baseName = parts.at(-1) ?? "";

  return (
    relativePath === ".git" ||
    parts.some((part) => generatedDirectoryNames.has(part) || part === ".git") ||
    copyExcludedFileNames.has(baseName) ||
    (baseName.startsWith(".env.") && baseName !== ".env.example") ||
    forbiddenTrackedSuffixes.some((suffix) => baseName.endsWith(suffix))
  );
}

export function isFreshCopyPathAllowed(relativePath) {
  const normalised = normalisePath(relativePath);
  const parts = normalised.split("/");
  const baseName = parts.at(-1) ?? "";

  if (
    normalised.startsWith("../") ||
    path.isAbsolute(relativePath) ||
    parts.some((part) => generatedDirectoryNames.has(part) || part === ".git") ||
    copyExcludedFileNames.has(baseName) ||
    (baseName.startsWith(".env.") && baseName !== ".env.example")
  ) {
    return false;
  }

  return true;
}

export async function createFreshCopy(rootDirectory = repositoryRoot, options = {}) {
  const temporaryRoot = await mkdtemp(
    path.join(options.temporaryParent ?? os.tmpdir(), temporaryPrefix),
  );

  try {
    for (const relativeFile of freshCopyRootFiles) {
      const sourcePath = path.join(rootDirectory, relativeFile);

      if (!(await exists(sourcePath))) {
        continue;
      }

      await cp(sourcePath, path.join(temporaryRoot, relativeFile), {
        errorOnExist: true,
        force: false,
      });
    }

    for (const relativeDirectory of freshCopyRootDirectories) {
      const sourcePath = path.join(rootDirectory, relativeDirectory);

      if (!(await exists(sourcePath))) {
        continue;
      }

      await cp(sourcePath, path.join(temporaryRoot, relativeDirectory), {
        errorOnExist: true,
        filter: (candidatePath) => !shouldExcludeFromFreshCopy(candidatePath, rootDirectory),
        force: false,
        recursive: true,
      });
    }

    return temporaryRoot;
  } catch (error) {
    await removeFreshCopy(temporaryRoot);
    throw error;
  }
}

export async function removeFreshCopy(temporaryRoot) {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const expectedParent = path.resolve(os.tmpdir());
  const actualParent = path.dirname(resolvedTemporaryRoot);

  if (
    actualParent !== expectedParent ||
    !path.basename(resolvedTemporaryRoot).startsWith(temporaryPrefix)
  ) {
    throw new Error(`Refusing to remove unsafe temporary path "${resolvedTemporaryRoot}".`);
  }

  await rm(resolvedTemporaryRoot, { force: true, recursive: true });
}

export async function auditFreshCopy(temporaryRoot) {
  const files = await listFiles(temporaryRoot);
  const relativeFiles = files.map((filePath) =>
    normalisePath(path.relative(temporaryRoot, filePath)),
  );
  const excludedFiles = relativeFiles.filter(
    (relativeFile) => !isFreshCopyPathAllowed(relativeFile),
  );

  if (excludedFiles.length > 0) {
    throw new Error(`Temporary copy contains excluded content: ${excludedFiles.join(", ")}.`);
  }

  for (const requiredPath of [
    "apps",
    "decisions",
    "packages",
    "supabase",
    "testing",
    "tooling",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "README.md",
    "CONTRIBUTING.md",
    ".env.example",
  ]) {
    if (!(await exists(path.join(temporaryRoot, requiredPath)))) {
      throw new Error(`Temporary copy is missing required path "${requiredPath}".`);
    }
  }

  if (await exists(path.join(temporaryRoot, "docs"))) {
    throw new Error("Temporary copy must omit docs because foundation checks do not consume them.");
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

export async function captureProtectedSnapshot(rootDirectory = repositoryRoot) {
  const candidateFiles = [];

  for (const relativeFile of protectedRootFiles) {
    const filePath = path.join(rootDirectory, relativeFile);

    if (await exists(filePath)) {
      candidateFiles.push(filePath);
    }
  }

  for (const directoryName of protectedDirectoryNames) {
    const directoryPath = path.join(rootDirectory, directoryName);

    if (await exists(directoryPath)) {
      candidateFiles.push(...(await listFiles(directoryPath)));
    }
  }

  const snapshot = new Map();

  for (const filePath of candidateFiles) {
    const relativeFile = normalisePath(path.relative(rootDirectory, filePath));

    if (!isGeneratedOrHygieneArtifact(relativeFile)) {
      snapshot.set(relativeFile, await hashFile(filePath));
    }
  }

  return snapshot;
}

export function compareProtectedSnapshots(before, after) {
  const changed = [];
  const allFiles = new Set([...before.keys(), ...after.keys()]);

  for (const file of allFiles) {
    if (before.get(file) !== after.get(file)) {
      changed.push(file);
    }
  }

  if (changed.length > 0) {
    throw new Error(`Verification changed protected working files: ${changed.join(", ")}.`);
  }
}

export async function validateBuildOutputs(rootDirectory = repositoryRoot) {
  for (const application of expectedWorkspaces.filter((workspace) => workspace.kind === "app")) {
    const outputPath = path.join(rootDirectory, application.relativeRoot, ".next");

    if (!(await exists(outputPath)) || !(await stat(outputPath)).isDirectory()) {
      throw new Error(`${application.relativeRoot}/.next is missing after the build.`);
    }
  }

  for (const workspacePackage of expectedWorkspaces.filter(
    (workspace) => workspace.kind === "package",
  )) {
    const outputPath = path.join(rootDirectory, workspacePackage.relativeRoot, "dist");

    if (!(await exists(outputPath)) || !(await stat(outputPath)).isDirectory()) {
      throw new Error(`${workspacePackage.relativeRoot}/dist is missing after the build.`);
    }
  }
}

export async function runWorkspaceVerification(rootDirectory = repositoryRoot) {
  await validateToolVersions(rootDirectory);
  await validateWorkspaceStructure(rootDirectory);
  await validateRepositoryHygiene(rootDirectory);
  await validateCleanupSafety(rootDirectory);
}
