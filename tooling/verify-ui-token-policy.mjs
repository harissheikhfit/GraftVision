import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styleDirectory = path.join(rootDirectory, "packages/ui/src/styles");
const tokenSourcePath = path.join(styleDirectory, "tokens.css");
const brandMetadataPath = path.join(rootDirectory, "packages/ui/src/brand-boundaries.ts");
const uiManifestPath = path.join(rootDirectory, "packages/ui/package.json");
const applications = ["present", "scan", "web"];
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision UI token policy verifier

Usage:
  corepack pnpm verify:ui-token-policy

Checks token uniqueness and references, required semantic and presentation roles,
WCAG contrast pairings, clinic override boundaries, anatomical distinctions,
shared application imports, reduced motion, focus/high-contrast handling, explicit
package exports, and absence of raw app colours, external fonts, Tailwind, secrets,
or clinic-specific production values.`);
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

function parseCustomProperties(source, sourceName) {
  const properties = new Map();
  const declarationPattern = /^\s*(--gv-[a-z0-9-]+)\s*:\s*([^;]+);/gmu;

  for (const match of source.matchAll(declarationPattern)) {
    const [, name, value] = match;

    if (!name || !value) {
      continue;
    }

    if (properties.has(name)) {
      throw new Error(`${sourceName}: duplicate token declaration "${name}".`);
    }

    properties.set(name, value.trim().replace(/\s+/gu, " "));
  }

  return properties;
}

function resolveTokenValue(tokenName, properties, chain = []) {
  if (chain.includes(tokenName)) {
    throw new Error(`Circular CSS token reference: ${[...chain, tokenName].join(" -> ")}.`);
  }

  const rawValue = properties.get(tokenName);

  if (!rawValue) {
    throw new Error(`Missing CSS token "${tokenName}".`);
  }

  const exactReference = /^var\((--gv-[a-z0-9-]+)\)$/u.exec(rawValue);

  if (exactReference?.[1]) {
    return resolveTokenValue(exactReference[1], properties, [...chain, tokenName]);
  }

  return rawValue;
}

function parseHexColour(value) {
  const match = /^#([a-f0-9]{6})$/iu.exec(value);

  if (!match?.[1]) {
    throw new Error(`Contrast value "${value}" is not a six-digit hex colour.`);
  }

  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function relativeLuminance(value) {
  const channels = parseHexColour(value).map((channel) => {
    const normalised = channel / 255;
    return normalised <= 0.04045 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0732 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function verifyContrastPair(properties, foregroundToken, backgroundToken, minimumRatio) {
  const foreground = resolveTokenValue(foregroundToken, properties);
  const background = resolveTokenValue(backgroundToken, properties);
  const ratio = contrastRatio(foreground, background);

  assert(
    ratio >= minimumRatio,
    `${foregroundToken} on ${backgroundToken} has ${ratio.toFixed(2)}:1 contrast; ` +
      `${minimumRatio}:1 is required.`,
  );

  return `${foregroundToken} on ${backgroundToken}: ${ratio.toFixed(2)}:1`;
}

const styleFiles = (await listFiles(styleDirectory)).filter((filePath) =>
  filePath.endsWith(".css"),
);
const styleSources = new Map(
  await Promise.all(
    styleFiles.map(async (filePath) => [filePath, await readFile(filePath, "utf8")]),
  ),
);
const allProperties = new Map();

for (const [filePath, source] of styleSources) {
  const relativeFile = normalisePath(path.relative(rootDirectory, filePath));
  const fileProperties = parseCustomProperties(source, relativeFile);

  for (const [name, value] of fileProperties) {
    if (allProperties.has(name)) {
      throw new Error(`${relativeFile}: token "${name}" is already defined in another stylesheet.`);
    }

    allProperties.set(name, value);
  }
}

const requiredTokens = [
  "--gv-color-background",
  "--gv-color-surface",
  "--gv-color-surface-elevated",
  "--gv-color-border",
  "--gv-color-border-strong",
  "--gv-color-text-primary",
  "--gv-color-text-secondary",
  "--gv-color-text-muted",
  "--gv-color-link",
  "--gv-color-focus",
  "--gv-color-success-text",
  "--gv-color-warning-text",
  "--gv-color-error-text",
  "--gv-color-information-text",
  "--gv-color-restricted-text",
  "--gv-color-preliminary-text",
  "--gv-color-doctor-approved-text",
  "--gv-color-ai-assisted-text",
  "--gv-color-patient-safe-text",
  "--gv-color-internal-text",
  "--gv-color-disabled-text",
  "--gv-color-selection",
  "--gv-border-default",
  "--gv-border-strong",
  "--gv-border-focus",
  "--gv-border-error",
  "--gv-border-approved",
  "--gv-border-restricted",
  "--gv-shadow-none",
  "--gv-shadow-subtle",
  "--gv-shadow-floating",
  "--gv-shadow-overlay",
  "--gv-focus-outline",
  "--gv-focus-outline-high-contrast",
  "--gv-motion-duration-fast",
  "--gv-motion-duration-standard",
  "--gv-motion-duration-slow",
  "--gv-motion-easing-standard",
  "--gv-motion-reduced-duration",
  "--gv-layer-base",
  "--gv-layer-sticky",
  "--gv-layer-dropdown",
  "--gv-layer-overlay",
  "--gv-layer-modal",
  "--gv-layer-toast",
  "--gv-layer-critical-lock",
  "--gv-breakpoint-small-mobile",
  "--gv-breakpoint-mobile",
  "--gv-breakpoint-tablet",
  "--gv-breakpoint-desktop",
  "--gv-breakpoint-wide",
  "--gv-breakpoint-presentation",
  "--gv-density-comfortable-gap",
  "--gv-density-compact-gap",
  "--gv-density-presentation-gap",
  "--gv-presentation-background",
  "--gv-presentation-surface",
  "--gv-presentation-text",
  "--gv-presentation-text-muted",
  "--gv-presentation-expired-background",
  "--gv-presentation-expired-text",
];

for (const requiredToken of requiredTokens) {
  assert(allProperties.has(requiredToken), `Required token "${requiredToken}" is missing.`);
}

for (const [filePath, source] of styleSources) {
  const relativeFile = normalisePath(path.relative(rootDirectory, filePath));
  const referencePattern = /var\((--gv-[a-z0-9-]+)(?:\s*,[^)]*)?\)/gu;

  for (const match of source.matchAll(referencePattern)) {
    const referencedToken = match[1];
    assert(
      referencedToken && allProperties.has(referencedToken),
      `${relativeFile}: custom-property reference "${referencedToken}" is undefined.`,
    );
  }
}

const contrastChecks = [
  ["--gv-color-text-primary", "--gv-color-background", 4.5],
  ["--gv-color-text-secondary", "--gv-color-background", 4.5],
  ["--gv-color-link", "--gv-color-background", 4.5],
  ["--gv-color-focus", "--gv-color-surface", 3],
  ["--gv-color-success-text", "--gv-color-success-surface", 4.5],
  ["--gv-color-warning-text", "--gv-color-warning-surface", 4.5],
  ["--gv-color-error-text", "--gv-color-error-surface", 4.5],
  ["--gv-color-restricted-text", "--gv-color-restricted-surface", 4.5],
  ["--gv-color-doctor-approved-text", "--gv-color-doctor-approved-surface", 4.5],
  ["--gv-color-ai-assisted-text", "--gv-color-ai-assisted-surface", 4.5],
  ["--gv-color-patient-safe-text", "--gv-color-patient-safe-surface", 4.5],
  ["--gv-presentation-text", "--gv-presentation-background", 4.5],
  ["--gv-presentation-text-muted", "--gv-presentation-surface", 4.5],
];
const contrastResults = contrastChecks.map(([foreground, background, minimum]) =>
  verifyContrastPair(allProperties, foreground, background, minimum),
);

const regionTokens = [
  "--gv-region-frontal",
  "--gv-region-mid-scalp",
  "--gv-region-crown",
  "--gv-region-left-temple",
  "--gv-region-right-temple",
  "--gv-region-donor-area",
  "--gv-region-existing-hair",
  "--gv-region-proposed-hairline",
  "--gv-region-ai-suggested",
  "--gv-region-doctor-approved",
  "--gv-region-superseded",
];
const resolvedRegionValues = regionTokens.map((token) => resolveTokenValue(token, allProperties));

assert.equal(
  new Set(resolvedRegionValues).size,
  regionTokens.length,
  "Anatomical and planning tokens must remain visually distinct.",
);

const brandMetadata = await readFile(brandMetadataPath, "utf8");
const allowedBrandTokens = [
  "--gv-brand-primary",
  "--gv-brand-secondary",
  "--gv-brand-link",
  "--gv-brand-selected-control",
];
const protectedPrefixes = [
  "--gv-color-error",
  "--gv-color-warning",
  "--gv-color-success",
  "--gv-color-information",
  "--gv-color-restricted",
  "--gv-color-preliminary",
  "--gv-color-doctor-approved",
  "--gv-color-ai-assisted",
  "--gv-color-patient-safe",
  "--gv-color-internal",
  "--gv-color-focus",
  "--gv-color-disabled",
  "--gv-focus-",
  "--gv-border-error",
  "--gv-region-",
  "--gv-space-",
  "--gv-font-",
  "--gv-motion-",
  "--gv-layer-",
  "--gv-presentation-expired",
];

for (const allowedToken of allowedBrandTokens) {
  assert(allProperties.has(allowedToken), `Brand token "${allowedToken}" is missing from CSS.`);
  assert(
    brandMetadata.includes(`"${allowedToken}"`),
    `Brand token "${allowedToken}" is missing from the TypeScript allowlist.`,
  );
  assert(
    !protectedPrefixes.some((prefix) => allowedToken.startsWith(prefix)),
    `Brand token "${allowedToken}" overlaps a protected prefix.`,
  );
}

for (const protectedPrefix of protectedPrefixes) {
  assert(
    brandMetadata.includes(`"${protectedPrefix}"`),
    `Protected prefix "${protectedPrefix}" is missing from metadata.`,
  );
}

const tokenSource = await readFile(tokenSourcePath, "utf8");
const foundationSource = await readFile(path.join(styleDirectory, "foundations.css"), "utf8");

assert(tokenSource.includes("Exact values remain subject to design"));
assert(foundationSource.includes("@media (prefers-reduced-motion: reduce)"));
assert(foundationSource.includes("@media (forced-colors: active)"));
assert(foundationSource.includes("outline: var(--gv-focus-outline)"));
assert(foundationSource.includes("outline: var(--gv-focus-outline-high-contrast)"));

const rawColourPattern = /#[a-f0-9]{3,8}\b|\b(?:rgb|hsl|oklch)\(/giu;

for (const application of applications) {
  const appSourceDirectory = path.join(rootDirectory, `apps/${application}/src`);
  const appFiles = await listFiles(appSourceDirectory);
  const globalsPath = path.join(appSourceDirectory, "app/globals.css");
  const globalsSource = await readFile(globalsPath, "utf8");

  assert.equal(
    globalsSource.match(/@import\s+["']@graftvision\/ui\/styles\.css["']/gu)?.length,
    1,
    `${application}: globals.css must import the shared UI foundation exactly once.`,
  );
  assert(
    !/^\s*--gv-[a-z0-9-]+\s*:/gmu.test(globalsSource),
    `${application}: applications cannot redefine shared tokens.`,
  );

  for (const appFile of appFiles.filter((filePath) => /\.(?:css|tsx?)$/u.test(filePath))) {
    const source = await readFile(appFile, "utf8");
    const referencePattern = /var\((--gv-[a-z0-9-]+)(?:\s*,[^)]*)?\)/gu;

    assert(
      !rawColourPattern.test(source),
      `${normalisePath(path.relative(rootDirectory, appFile))}: raw colours are prohibited.`,
    );
    rawColourPattern.lastIndex = 0;

    for (const match of source.matchAll(referencePattern)) {
      assert(
        match[1] && allProperties.has(match[1]),
        `${normalisePath(path.relative(rootDirectory, appFile))}: ` +
          `custom-property reference "${match[1]}" is undefined.`,
      );
    }
  }
}

const uiManifest = JSON.parse(await readFile(uiManifestPath, "utf8"));

assert.equal(uiManifest.exports["./styles.css"], "./src/styles/index.css");
assert(uiManifest.exports["."], "The UI TypeScript public entry is missing.");
assert(
  uiManifest.sideEffects.includes("./src/styles/index.css"),
  "The shared CSS entry must remain side-effectful.",
);

const allManifestFiles = [
  path.join(rootDirectory, "package.json"),
  ...applications.map((application) =>
    path.join(rootDirectory, `apps/${application}/package.json`),
  ),
  ...["auth", "config", "database", "types", "ui"].map((workspacePackage) =>
    path.join(rootDirectory, `packages/${workspacePackage}/package.json`),
  ),
];

for (const manifestFile of allManifestFiles) {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };

  for (const prohibitedDependency of [
    "@tailwindcss/postcss",
    "@tailwindcss/vite",
    "styled-components",
    "tailwindcss",
  ]) {
    assert(
      !Object.hasOwn(dependencies, prohibitedDependency),
      `${normalisePath(path.relative(rootDirectory, manifestFile))}: ` +
        `"${prohibitedDependency}" is not approved for UI-FOUNDATION-001.`,
    );
  }
}

const uiSourceFiles = (await listFiles(path.join(rootDirectory, "packages/ui/src"))).filter(
  (filePath) => /\.(?:css|tsx?)$/u.test(filePath),
);

for (const uiSourceFile of uiSourceFiles) {
  const source = await readFile(uiSourceFile, "utf8");
  const relativeFile = normalisePath(path.relative(rootDirectory, uiSourceFile));

  assert(
    !source.includes("@font-face"),
    `${relativeFile}: external/local font files are deferred.`,
  );
  assert(!source.includes("next/font"), `${relativeFile}: external font loading is deferred.`);
  assert(
    !/(?:FACE Aesthetic|Dr Sheraz|api[_-]?key\s*[:=]|client[_-]?secret\s*[:=])/iu.test(source),
    `${relativeFile}: clinic-specific or secret-like production content is prohibited.`,
  );
}

console.log("UI token contrast verification:");

for (const result of contrastResults) {
  console.log(`- ${result}`);
}

console.log(
  `UI token policy passed: ${allProperties.size} unique CSS tokens, ` +
    `${regionTokens.length} distinct region roles, protected clinic-brand boundaries, ` +
    "shared app imports, reduced motion, visible focus, explicit exports, and no CSS framework.",
);
