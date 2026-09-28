import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDirectory = path.join(rootDirectory, "packages/ui");
const sourceDirectory = path.join(uiDirectory, "src");
const primitiveDirectory = path.join(sourceDirectory, "primitives");
const formDirectory = path.join(sourceDirectory, "forms");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision UI primitive policy verifier

Usage:
  corepack pnpm verify:ui-primitive-policy

Checks explicit exports, native semantics, minimal client boundaries, accessibility
tests, logical CSS, touch targets, protected focus/error/destructive tokens, and
absence of product UI, clinical imports, Tailwind, form libraries, or frameworks.`);
  process.exit(0);
}

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
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

const [entrySource, primitiveStyles, packageGuide, uiManifestSource, rootManifestSource] =
  await Promise.all([
    readFile(path.join(sourceDirectory, "index.ts"), "utf8"),
    readFile(path.join(sourceDirectory, "styles/primitives.css"), "utf8"),
    readFile(path.join(uiDirectory, "README.md"), "utf8"),
    readFile(path.join(uiDirectory, "package.json"), "utf8"),
    readFile(path.join(rootDirectory, "package.json"), "utf8"),
  ]);
const uiManifest = JSON.parse(uiManifestSource);
const rootManifest = JSON.parse(rootManifestSource);
const requiredExports = [
  "Button",
  "Checkbox",
  "Field",
  "FieldDescription",
  "FieldError",
  "FieldLabel",
  "IconButton",
  "Link",
  "RadioGroup",
  "Select",
  "Switch",
  "Textarea",
  "TextInput",
  "VisuallyHidden",
];

for (const requiredExport of requiredExports) {
  assert(
    new RegExp(`\\b${requiredExport}\\b`, "u").test(entrySource),
    `packages/ui/src/index.ts must explicitly export ${requiredExport}.`,
  );
}

assert(!entrySource.includes("export *"), "UI wildcard exports are prohibited.");
assert.equal(uiManifest.exports["."].import, "./src/index.ts");
assert.equal(uiManifest.exports["./styles.css"], "./src/styles/index.css");
assert(uiManifest.sideEffects.includes("./src/styles/primitives.css"));
assert.equal(
  rootManifest.scripts["verify:ui-primitive-policy"],
  "node tooling/verify-ui-primitive-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-ui-primitive-policy.mjs"));

for (const requiredGuideText of [
  "native controls",
  "Field composition",
  "Client and server boundaries",
  "Clinic brand tokens",
  "No axe dependency was added",
  "Dialogs, drawers, tooltips",
]) {
  assert(
    packageGuide.includes(requiredGuideText),
    `packages/ui/README.md must document "${requiredGuideText}".`,
  );
}

const componentFiles = [
  ...(await listFiles(primitiveDirectory)),
  ...(await listFiles(formDirectory)),
].filter((filePath) => filePath.endsWith(".tsx") && !filePath.endsWith(".test.tsx"));
const clientComponentFiles = [];
const productScopePattern =
  /\b(?:auth|clinic|consultation|graft|hairline|patient|procedure|report|scan|surgery)\b/iu;
const hardCodedColourPattern = /#[a-f0-9]{3,8}\b|\b(?:rgb|hsl|oklch)\(/iu;

for (const componentFile of componentFiles) {
  const source = await readFile(componentFile, "utf8");
  const relativeFile = normalisePath(path.relative(rootDirectory, componentFile));

  if (source.startsWith('"use client";')) {
    clientComponentFiles.push(relativeFile);
  }

  assert(!productScopePattern.test(source), `${relativeFile}: product-specific UI is prohibited.`);
  assert(
    !hardCodedColourPattern.test(source),
    `${relativeFile}: hard-coded colours are prohibited.`,
  );
  assert(
    !/@graftvision\/(?:auth|database)|@supabase\//u.test(source),
    `${relativeFile}: clinical/server/provider imports are prohibited.`,
  );
  assert(
    !/\b(?:className|class)\s*=\s*["'](?:bg|p|px|py|rounded)-/u.test(source),
    `${relativeFile}: Tailwind-like utility styling is prohibited.`,
  );
}

assert.deepEqual(clientComponentFiles, [
  "packages/ui/src/primitives/checkbox.tsx",
  "packages/ui/src/forms/search-field.tsx",
]);

for (const nativeContract of [
  ["primitives/button.tsx", "<button"],
  ["primitives/icon-button.tsx", "<button"],
  ["primitives/link.tsx", "<a"],
  ["primitives/text-input.tsx", "<input"],
  ["primitives/textarea.tsx", "<textarea"],
  ["primitives/select.tsx", "<select"],
  ["primitives/checkbox.tsx", 'type="checkbox"'],
  ["primitives/radio-group.tsx", "<fieldset"],
  ["primitives/radio-group.tsx", 'type="radio"'],
  ["primitives/switch.tsx", 'role="switch"'],
]) {
  const [relativeFile, requiredText] = nativeContract;
  const source = await readFile(path.join(sourceDirectory, relativeFile), "utf8");
  assert(source.includes(requiredText), `${relativeFile} must retain ${requiredText}.`);
}

for (const logicalProperty of [
  "inline-size",
  "block-size",
  "padding-inline",
  "margin-inline-start",
  "inset-inline-start",
]) {
  assert(
    primitiveStyles.includes(logicalProperty),
    `Primitive CSS must use logical property ${logicalProperty}.`,
  );
}

assert(
  !/^\s*(?:bottom|height|left|margin-left|margin-right|padding-left|padding-right|right|top|width)\s*:/gmu.test(
    primitiveStyles,
  ),
  "Primitive CSS must not use physical directional or size properties.",
);
assert(primitiveStyles.includes("var(--gv-touch-target-minimum)"));
assert(primitiveStyles.includes("outline: var(--gv-focus-outline)"));
assert(primitiveStyles.includes("border: var(--gv-border-error)"));
assert(primitiveStyles.includes("background: var(--gv-color-error-surface)"));
assert(
  !/gv-(?:button|control|field)[^{]*\{[^}]*(?:--gv-region-|--gv-color-doctor-approved)/su.test(
    primitiveStyles,
  ),
  "Generic primitives cannot use anatomical or approval tokens.",
);

const testFiles = (await listFiles(sourceDirectory)).filter((filePath) =>
  filePath.endsWith(".test.tsx"),
);
const testSources = await Promise.all(testFiles.map((filePath) => readFile(filePath, "utf8")));
const combinedTests = testSources.join("\n");

for (const requiredTestText of [
  "userEvent.setup",
  "toHaveFocus",
  "toBeDisabled",
  "aria-describedby",
  "aria-invalid",
  "toBePartiallyChecked",
  "{ArrowDown}",
  'getByRole("switch"',
]) {
  assert(
    combinedTests.includes(requiredTestText),
    `UI interaction tests must cover "${requiredTestText}".`,
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
  "@headlessui/react",
  "@radix-ui/react-form",
  "@tailwindcss/postcss",
  "formik",
  "react-aria",
  "react-hook-form",
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
        `${prohibitedDependency} is outside UI-FOUNDATION-002.`,
    );
  }
}

console.log(
  `UI primitive policy passed: ${requiredExports.length} explicit primitives, ` +
    `${componentFiles.length} component files, two justified client boundaries, native semantics, ` +
    "interaction tests, logical CSS, protected state tokens, and no product/form-framework scope.",
);
