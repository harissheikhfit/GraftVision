import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDirectory = path.join(rootDirectory, "packages/ui");
const sourceDirectory = path.join(uiDirectory, "src");
const stateDirectory = path.join(sourceDirectory, "states");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision UI state-display policy verifier

Usage:
  corepack pnpm verify:ui-state-policy

Checks explicit state exports, files, server boundaries, native progress semantics,
live-region tests, protected tokens, privacy-safe copy, shell adoption, and absence
of product state, hard-coded colours, broad frameworks, or icon libraries.`);
  process.exit(0);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
}

const requiredComponents = [
  "AIAssistedBadge",
  "ApprovalBadge",
  "Banner",
  "EmptyState",
  "ErrorState",
  "InlineMessage",
  "LoadingBlock",
  "LoadingIndicator",
  "PatientSafeBadge",
  "PermissionDeniedState",
  "PrivacyBadge",
  "ProcessingState",
  "ProgressIndicator",
  "RestrictedBadge",
  "ScreenLockState",
  "SessionExpiredState",
  "Skeleton",
  "StatusBadge",
  "SuccessState",
  "WarningState",
];
const requiredComponentFiles = requiredComponents.map((component) =>
  component === "AIAssistedBadge"
    ? "ai-assisted-badge"
    : component.replaceAll(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase(),
);

const [
  entrySource,
  stateStyles,
  styleEntry,
  packageGuide,
  rootGuide,
  uiManifestSource,
  rootManifestSource,
] = await Promise.all([
  readFile(path.join(sourceDirectory, "index.ts"), "utf8"),
  readFile(path.join(sourceDirectory, "styles/states.css"), "utf8"),
  readFile(path.join(sourceDirectory, "styles/index.css"), "utf8"),
  readFile(path.join(uiDirectory, "README.md"), "utf8"),
  readFile(path.join(rootDirectory, "README.md"), "utf8"),
  readFile(path.join(uiDirectory, "package.json"), "utf8"),
  readFile(path.join(rootDirectory, "package.json"), "utf8"),
]);
const uiManifest = JSON.parse(uiManifestSource);
const rootManifest = JSON.parse(rootManifestSource);

for (const requiredComponent of requiredComponents) {
  assert(
    new RegExp(`\\b${requiredComponent}\\b`, "u").test(entrySource),
    `packages/ui/src/index.ts must explicitly export ${requiredComponent}.`,
  );
}

for (const requiredFile of requiredComponentFiles) {
  const source = await readFile(path.join(stateDirectory, `${requiredFile}.tsx`), "utf8");
  assert(source.length > 0, `${requiredFile}.tsx must not be empty.`);
}

for (const taxonomy of [
  "approvalStates",
  "connectivityStates",
  "operationalStates",
  "privacyStates",
]) {
  assert(entrySource.includes(taxonomy), `UI entry must export ${taxonomy}.`);
}

assert(!entrySource.includes("export *"), "UI wildcard exports are prohibited.");
assert(
  !entrySource.includes("internal-state-display"),
  "Internal state helpers must stay private.",
);
assert(styleEntry.includes('@import "./states.css";'));
assert(uiManifest.sideEffects.includes("./src/styles/states.css"));
assert.equal(
  rootManifest.scripts["verify:ui-state-policy"],
  "node tooling/verify-ui-state-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-ui-state-policy.mjs"));

for (const requiredGuideText of [
  "State-display components",
  "Shared state taxonomy",
  "State copy and privacy",
  "State accessibility and live regions",
  "Clinic-brand protection",
  "All state-display components are Server Component compatible",
  "No axe dependency was added",
  "Out-of-scope state work",
]) {
  assert(
    packageGuide.includes(requiredGuideText),
    `UI guide must document "${requiredGuideText}".`,
  );
}

for (const requiredRootText of [
  "Shared State Displays",
  "non-colour cue",
  "Privacy-safe",
  "No product-specific state",
]) {
  assert(rootGuide.includes(requiredRootText), `Root README must document "${requiredRootText}".`);
}

const stateFiles = await listFiles(stateDirectory);
const componentFiles = stateFiles.filter(
  (filePath) => filePath.endsWith(".tsx") && !filePath.endsWith(".test.tsx"),
);
const combinedComponents = (
  await Promise.all(componentFiles.map((filePath) => readFile(filePath, "utf8")))
).join("\n");

for (const componentFile of componentFiles) {
  const source = await readFile(componentFile, "utf8");
  const relativeFile = normalisePath(path.relative(rootDirectory, componentFile));

  assert(!source.startsWith('"use client";'), `${relativeFile} must remain server compatible.`);
  assert(
    !/@graftvision\/(?:auth|database)|@supabase\//u.test(source),
    `${relativeFile}: privileged or provider imports are prohibited.`,
  );
  assert(
    !/\b(?:clinicId|graft|hairline|procedure|reportId|scanId|tenantId)\b/iu.test(source),
    `${relativeFile}: product-domain contracts are prohibited.`,
  );
  assert(!/\bonClick\s*=/u.test(source), `${relativeFile}: state surfaces cannot invent clicks.`);
}

assert(combinedComponents.includes("<progress"), "ProgressIndicator must use native progress.");
assert(
  combinedComponents.includes('role="status"'),
  "Loading state must expose deliberate status semantics.",
);
assert(
  combinedComponents.includes("role={role}"),
  "Message roles must be selected deliberately by state.",
);
assert(
  !/#[a-f0-9]{3,8}\b|\b(?:rgb|hsl|oklch)\(/iu.test(stateStyles),
  "State CSS must not use hard-coded colours.",
);
assert(!stateStyles.includes("--gv-region-"), "State CSS cannot use anatomical tokens.");
assert(!stateStyles.includes("--gv-brand-"), "Protected state CSS cannot use clinic brand tokens.");

for (const protectedToken of [
  "--gv-color-error",
  "--gv-color-warning",
  "--gv-color-restricted",
  "--gv-color-doctor-approved",
  "--gv-color-ai-assisted",
  "--gv-color-patient-safe",
  "--gv-presentation-expired",
]) {
  assert(stateStyles.includes(protectedToken), `State CSS must use ${protectedToken}.`);
}

for (const accessibilityContract of [
  "@media (prefers-reduced-motion: no-preference)",
  "@media (forced-colors: active)",
  "var(--gv-touch-target-minimum)",
  "aria-live",
  "aria-hidden",
  "aria-busy",
]) {
  assert(
    stateStyles.includes(accessibilityContract) ||
      combinedComponents.includes(accessibilityContract),
    `State displays must cover ${accessibilityContract}.`,
  );
}

const testFiles = stateFiles.filter((filePath) => filePath.endsWith(".test.tsx"));
const combinedTests = (
  await Promise.all(testFiles.map((filePath) => readFile(filePath, "utf8")))
).join("\n");

for (const requiredTestText of [
  'getByRole("alert")',
  'getByRole("note")',
  'getByRole("progressbar"',
  'getByRole("status"',
  'aria-hidden", "true"',
  'aria-live", "polite"',
  "userEvent.setup",
  "toHaveFocus",
  'not.toHaveTextContent("approved")',
  "not.toBeInTheDocument()",
]) {
  assert(
    combinedTests.includes(requiredTestText),
    `State-display tests must cover "${requiredTestText}".`,
  );
}

for (const application of ["present", "scan", "web"]) {
  const loadingSource = await readFile(
    path.join(rootDirectory, `apps/${application}/src/app/loading.tsx`),
    "utf8",
  );
  assert(
    loadingSource.includes("LoadingBlock"),
    `${application} must verify LoadingBlock adoption.`,
  );
  assert(
    !loadingSource.includes('"use client"'),
    `${application} loading must stay server-rendered.`,
  );
}

const manifestFiles = [
  path.join(rootDirectory, "package.json"),
  ...["present", "scan", "web"].map((application) =>
    path.join(rootDirectory, `apps/${application}/package.json`),
  ),
  ...["auth", "config", "database", "types", "ui"].map((workspacePackage) =>
    path.join(rootDirectory, `packages/${workspacePackage}/package.json`),
  ),
];
const prohibitedDependencies = [
  "@fortawesome/react-fontawesome",
  "@headlessui/react",
  "@heroicons/react",
  "@radix-ui/react-icons",
  "@tailwindcss/postcss",
  "lucide-react",
  "react-icons",
  "tailwindcss",
];

for (const manifestFile of manifestFiles) {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };

  for (const prohibitedDependency of prohibitedDependencies) {
    assert(
      !Object.hasOwn(dependencies, prohibitedDependency),
      `${normalisePath(path.relative(rootDirectory, manifestFile))}: ` +
        `${prohibitedDependency} is outside UI-FOUNDATION-003.`,
    );
  }
}

console.log(
  `UI state-display policy passed: ${requiredComponents.length} public components, ` +
    `${testFiles.length} test files, four display taxonomies, protected tokens, native progress, ` +
    "privacy-safe copy, server-compatible boundaries, cross-app loading adoption, and no product scope.",
);
