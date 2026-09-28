import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shellDirectory = path.join(rootDirectory, "packages/ui/src/shells");

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

const shellEntries = await readdir(shellDirectory, { withFileTypes: true });
const shellFiles = shellEntries
  .filter(
    (entry) => entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test."),
  )
  .map((entry) => `packages/ui/src/shells/${entry.name}`);
const shellSources = await Promise.all(shellFiles.map(read));
const combinedShellSource = shellSources.join("\n");
const uiEntry = await read("packages/ui/src/index.ts");
const shellStyles = await read("packages/ui/src/styles/shells.css");
const rootManifest = JSON.parse(await read("package.json"));
const uiManifest = JSON.parse(await read("packages/ui/package.json"));

const requiredExports = [
  "AppShell",
  "PublicShell",
  "ClinicShell",
  "PlatformShell",
  "ScanShell",
  "PresentationShell",
  "ShellHeader",
  "ShellSidebar",
  "ShellNavigation",
  "ShellNavigationItem",
  "ShellMain",
  "ShellContent",
  "ShellToolbar",
  "ShellFooter",
  "MobileShellHeader",
  "MobileBottomBar",
  "PresentationStage",
  "PresentationHeader",
  "PresentationFooter",
  "SharedDeviceIndicator",
  "ActiveUserIndicator",
  "ActiveContextBanner",
  "PrivacyContextBar",
  "SessionContextBar",
  "ResponsiveShellRegion",
  "SkipNavigation",
  "ShellOverlayRegion",
  "ShellLockLayer",
];

for (const publicExport of requiredExports) {
  assert(
    uiEntry.includes(` ${publicExport},`) || uiEntry.includes(`{ ${publicExport},`),
    `Missing explicit shell export: ${publicExport}`,
  );
}

assert(!uiEntry.includes('from "./shells";'), "Shells must not use an implicit barrel export");
assert(
  shellSources.every((source) => !source.includes('"use client"')),
  "Shared shell foundations must stay Server Component compatible",
);
assert(
  !combinedShellSource.match(
    /@graftvision\/(?:auth|database|types)|\.\.\/\.\.\/(?:auth|database)/u,
  ),
  "Shell foundations must not import auth, database, or domain packages",
);
assert(
  !combinedShellSource.match(/\b(?:patientId|clinicId|consultationId|procedureId)\b/u),
  "Shell foundations must not define domain identifiers",
);

const routeShells = new Map([
  ["apps/web/src/app/(public)/page.tsx", "PublicShell"],
  ["apps/web/src/app/(clinic)/clinic/page.tsx", "ClinicShell"],
  ["apps/web/src/app/(platform)/platform/page.tsx", "PlatformShell"],
  ["apps/scan/src/app/page.tsx", "ScanShell"],
  ["apps/scan/src/app/session/page.tsx", "ScanShell"],
  ["apps/present/src/app/page.tsx", "PresentationShell"],
  ["apps/present/src/app/session/page.tsx", "PresentationShell"],
]);

const routeSources = [];
for (const [route, shell] of routeShells) {
  const source = await read(route);
  routeSources.push(source);
  assert(source.includes(shell), `${route} must adopt ${shell}`);
  assert(!source.includes('"use client"'), `${route} must remain server rendered`);
}

const prohibitedNavigationLabels = [
  "Dashboard",
  "Consultations",
  "Procedures",
  "Reports",
  "Plans",
  "Usage",
];
const routeAndTestSource = [
  ...routeSources,
  await read("packages/ui/src/shells/application-shells.test.tsx"),
].join("\n");

for (const label of prohibitedNavigationLabels) {
  assert(
    !routeAndTestSource.includes(`label="${label}"`),
    `Product navigation label is outside this task: ${label}`,
  );
}

const scanShell = await read("packages/ui/src/shells/scan-shell.tsx");
const presentationShell = await read("packages/ui/src/shells/presentation-shell.tsx");
assert(!scanShell.includes("ShellNavigation"), "ScanShell must not expose general navigation");
assert(!scanShell.match(/camera|capture control|patient search/iu), "Scan behavior is deferred");
assert(
  !presentationShell.includes("ShellNavigation"),
  "PresentationShell must not expose private navigation",
);
assert(
  !presentationShell.match(/download|patient search|active user/iu),
  "PresentationShell must exclude private controls",
);
assert(
  presentationShell.includes("PresentationHeader"),
  "PresentationShell must retain its patient-safe header",
);

for (const requiredFragment of [
  "inert={locked}",
  "aria-hidden={locked || undefined}",
  "ScreenLockState",
]) {
  assert(
    combinedShellSource.includes(requiredFragment),
    `Missing lock safety: ${requiredFragment}`,
  );
}

for (const requiredStyle of [
  "env(safe-area-inset-bottom)",
  "@media (min-width: 48rem)",
  "@media (min-width: 64rem)",
  "@media (min-width: 120rem)",
  "var(--gv-layer-sticky)",
  "var(--gv-layer-overlay)",
  "var(--gv-layer-critical-lock)",
  "@media (forced-colors: active)",
  "@media (prefers-reduced-motion: no-preference)",
  "inline-size",
  "inset-inline-start",
  "border-inline-end",
  "overflow-wrap: anywhere",
]) {
  assert(shellStyles.includes(requiredStyle), `Shell CSS is missing: ${requiredStyle}`);
}

assert(
  !shellStyles.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(/iu),
  "Shell CSS must not add hard-coded colors",
);
assert(!shellStyles.includes("--gv-region-"), "Shell CSS must not use anatomical color tokens");
assert(!shellStyles.match(/z-index:\s*\d/iu), "Shell CSS must use shared layer tokens");
assert(
  !shellStyles.match(/\b(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/iu),
  "Shell CSS must use logical properties",
);
assert(
  shellStyles.includes(".gv-app-shell--presentation .gv-shell-lock-layer"),
  "Presentation lock styling must stay protected",
);
assert(
  !shellStyles.match(/gv-(?:privacy-context|shell-lock-layer)[^{]*\{[^}]*--gv-brand-/isu),
  "Brand tokens must not style privacy or lock regions",
);

assert(
  uiManifest.sideEffects.includes("./src/styles/shells.css"),
  "Shell CSS must be retained as a package side effect",
);
assert.equal(
  Object.keys(uiManifest.dependencies ?? {}).length,
  0,
  "Shell work must not add UI runtime dependencies",
);
assert(
  !JSON.stringify(rootManifest.dependencies ?? {}).match(/supabase|auth|redux|zustand/iu),
  "Shell work must not add product runtime dependencies",
);

for (const app of ["web", "scan", "present"]) {
  assert(
    !(await read(`apps/${app}/package.json`)).includes("@supabase"),
    `${app} must not add a provider dependency`,
  );
}

console.log(
  "UI shell pattern policy is valid: explicit exports, trust-separated app adoption, responsive and lock contracts, protected styling, and deferred product behavior.",
);
