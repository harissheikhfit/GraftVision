import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDirectory = path.join(rootDirectory, "packages/ui");
const sourceDirectory = path.join(uiDirectory, "src");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision UI information policy verifier

Usage:
  corepack pnpm verify:ui-information-policy

Checks data-entry, information, and layout exports; native semantics; raw-value and
copy safety; client boundaries; token/logical CSS; documentation; tests; dependency
policy; and absence of product screens, formatting libraries, or domain imports.`);
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

const componentGroups = {
  forms: [
    "FieldGroup",
    "FormSection",
    "InputGroup",
    "InputPrefix",
    "InputSuffix",
    "SearchField",
    "NumberField",
    "DateField",
    "TimeField",
    "SegmentedControl",
    "ReadOnlyField",
  ],
  information: [
    "DefinitionList",
    "KeyValueList",
    "MetadataList",
    "DataValue",
    "Stat",
    "DescriptionBlock",
    "CopyableValue",
    "ReferenceValue",
    "InformationPanel",
  ],
  layout: ["Divider", "Stack", "Inline", "Grid", "Container", "Section"],
};
const requiredComponents = Object.values(componentGroups).flat();
const requiredFiles = Object.entries(componentGroups).flatMap(([directory, components]) =>
  components.map((component) => ({
    component,
    file: path.join(
      sourceDirectory,
      directory,
      `${component.replaceAll(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase()}.tsx`,
    ),
  })),
);

const [
  entrySource,
  informationStyles,
  styleEntry,
  packageGuide,
  rootGuide,
  uiManifestSource,
  rootManifestSource,
] = await Promise.all([
  readFile(path.join(sourceDirectory, "index.ts"), "utf8"),
  readFile(path.join(sourceDirectory, "styles/information.css"), "utf8"),
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
    new RegExp(`export \\{[^;]*\\b${requiredComponent}\\b`, "su").test(entrySource),
    `packages/ui/src/index.ts must explicitly export ${requiredComponent}.`,
  );
}

for (const { component, file } of requiredFiles) {
  assert((await readFile(file, "utf8")).length > 0, `${component} source must not be empty.`);
}

assert(!entrySource.includes("export *"), "UI wildcard exports are prohibited.");
assert(!entrySource.includes("assign-ref"), "Private ref helpers must remain internal.");
assert(styleEntry.includes('@import "./information.css";'));
assert(uiManifest.sideEffects.includes("./src/styles/information.css"));
assert.equal(
  rootManifest.scripts["verify:ui-information-policy"],
  "node tooling/verify-ui-information-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-ui-information-policy.mjs"));

for (const requiredGuideText of [
  "Data-entry primitives",
  "Information primitives",
  "Layout primitives",
  "Native input strategy and raw-value preservation",
  "Copy and masking safety",
  "UI-FOUNDATION-004 client and server boundaries",
  "UI-FOUNDATION-004 usage limits",
  "Product forms",
]) {
  assert(
    packageGuide.includes(requiredGuideText),
    `packages/ui/README.md must document "${requiredGuideText}".`,
  );
}

for (const requiredRootText of [
  "Data-Entry, Information, and Layout Primitives",
  "raw string",
  "never automatically formatted",
  "No product form",
]) {
  assert(rootGuide.includes(requiredRootText), `Root README must document "${requiredRootText}".`);
}

const newComponentFiles = requiredFiles.map(({ file }) => file);
const clientFiles = [];
const prohibitedDomainContract =
  /\b(?:clinicId|consultationId|graftCount|hairline|patientId|procedureId|reportId|scanId|tenantId)\b/iu;
const prohibitedImport = /@graftvision\/(?:auth|database)|@supabase\//u;

for (const componentFile of newComponentFiles) {
  const source = await readFile(componentFile, "utf8");
  const relativeFile = normalisePath(path.relative(rootDirectory, componentFile));

  if (source.startsWith('"use client";')) {
    clientFiles.push(relativeFile);
  }

  assert(
    !prohibitedDomainContract.test(source),
    `${relativeFile}: domain contracts are prohibited.`,
  );
  assert(!prohibitedImport.test(source), `${relativeFile}: privileged imports are prohibited.`);
  assert(
    !/#[a-f0-9]{3,8}\b|\b(?:rgb|hsl|oklch)\(/iu.test(source),
    `${relativeFile}: hard-coded colours are prohibited.`,
  );
}

assert.deepEqual(clientFiles.sort(), [
  "packages/ui/src/forms/search-field.tsx",
  "packages/ui/src/information/copyable-value.tsx",
]);

const nativeContracts = [
  ["forms/field-group.tsx", "<fieldset"],
  ["forms/field-group.tsx", "<legend"],
  ["forms/search-field.tsx", 'type="search"'],
  ["forms/number-field.tsx", 'type="text"'],
  ["forms/date-field.tsx", 'type="date"'],
  ["forms/time-field.tsx", 'type="time"'],
  ["forms/segmented-control.tsx", "<fieldset"],
  ["forms/segmented-control.tsx", 'type="radio"'],
  ["information/definition-list.tsx", "<dl"],
  ["information/definition-list.tsx", "<dt>"],
  ["information/definition-list.tsx", "<dd"],
  ["primitives/select.tsx", "<select"],
];

for (const [relativeFile, requiredText] of nativeContracts) {
  const source = await readFile(path.join(sourceDirectory, relativeFile), "utf8");
  assert(source.includes(requiredText), `${relativeFile} must retain ${requiredText}.`);
}

const numberSource = await readFile(path.join(sourceDirectory, "forms/number-field.tsx"), "utf8");
assert(numberSource.includes("readonly value?: string"));
assert(numberSource.includes("readonly defaultValue?: string"));
assert(numberSource.includes("inputMode={resolvedInputMode}"));
assert(!/\bparse(?:Float|Int)\b|\bNumber\(|toLocaleString|Intl\./u.test(numberSource));

const copySource = await readFile(
  path.join(sourceDirectory, "information/copyable-value.tsx"),
  "utf8",
);
assert(copySource.includes("copyValue ?? displayValue"));
assert(copySource.includes("navigator.clipboard.writeText"));
assert(!/value\s*=\s*\{resolvedCopyValue\}|data-[^=]+=\{resolvedCopyValue\}/u.test(copySource));
assert(!copySource.includes("dangerouslySetInnerHTML"));

const readOnlySource = await readFile(
  path.join(sourceDirectory, "forms/read-only-field.tsx"),
  "utf8",
);
assert(readOnlySource.includes("masked ? maskedValue"));
assert(!/<input|<textarea|<select/u.test(readOnlySource));

const gridSource = await readFile(path.join(sourceDirectory, "layout/grid.tsx"), "utf8");
assert(gridSource.includes('Omit<ComponentPropsWithRef<"div">, "style">'));
assert(gridSource.includes("1 | 2 | 3 | 4"));
assert(gridSource.includes('"medium" | "small" | "wide"'));

for (const logicalProperty of [
  "inline-size",
  "block-size",
  "padding-inline",
  "margin-inline",
  "border-inline",
  "overflow-wrap",
]) {
  assert(
    informationStyles.includes(logicalProperty),
    `Information CSS must use logical property ${logicalProperty}.`,
  );
}

assert(
  !/^\s*(?:height|left|margin-left|margin-right|padding-left|padding-right|right|width)\s*:/gmu.test(
    informationStyles,
  ),
  "Information CSS must not use physical directional or size properties.",
);
assert(!/#[a-f0-9]{3,8}\b|\b(?:rgb|hsl|oklch)\(/iu.test(informationStyles));
assert(!informationStyles.includes("--gv-region-"));
assert(!informationStyles.includes("--gv-brand-"));
assert(informationStyles.includes("var(--gv-touch-target-minimum)"));
assert(informationStyles.includes("outline: var(--gv-focus-outline)"));
assert(informationStyles.includes("border: var(--gv-border-error)"));
assert(informationStyles.includes("var(--gv-color-restricted"));
assert(informationStyles.includes("@media (forced-colors: active)"));
assert(informationStyles.includes("@media (max-width:"));

const testFiles = (await listFiles(sourceDirectory)).filter((filePath) =>
  filePath.endsWith(".test.tsx"),
);
const combinedTests = (
  await Promise.all(testFiles.map((filePath) => readFile(filePath, "utf8")))
).join("\n");

for (const requiredTestText of [
  "12..3",
  'type", "date"',
  'type", "time"',
  "{ArrowRight}",
  "{Escape}",
  "mockClipboard",
  "Value copied.",
  "Value could not be copied.",
  "Not provided",
  "aria-describedby",
  'querySelectorAll("dt")',
  "gv-grid--columns-4",
  'not.toHaveAttribute("style")',
]) {
  assert(
    combinedTests.includes(requiredTestText),
    `UI information tests must cover "${requiredTestText}".`,
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
  "date-fns",
  "dayjs",
  "formik",
  "luxon",
  "moment",
  "numeral",
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
        `${prohibitedDependency} is outside UI-FOUNDATION-004.`,
    );
  }
}

console.log(
  `UI information policy passed: ${requiredComponents.length} explicit components, ` +
    "native semantics, raw string preservation, deliberate copy safety, two justified new client " +
    "boundaries, constrained responsive layout, logical/protected CSS, and no product or " +
    "formatting-library scope.",
);
