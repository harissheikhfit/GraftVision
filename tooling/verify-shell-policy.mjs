import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const applications = [
  {
    description: "Development patient-safe presentation shell",
    name: "present",
    routes: [
      ["src/app/page.tsx", "APP_TITLE", "PresentationShell"],
      ["src/app/session/page.tsx", "Temporary presentation shell", "PresentationShell"],
    ],
    title: "GraftVision Present",
  },
  {
    description: "Development mobile capture shell",
    name: "scan",
    routes: [
      ["src/app/page.tsx", "APP_TITLE", "ScanShell"],
      ["src/app/session/page.tsx", "Secure device pairing", "ScanShell"],
    ],
    title: "GraftVision Scan",
  },
  {
    description: "Development application shell",
    name: "web",
    routes: [
      ["src/app/(public)/page.tsx", "APP_TITLE", "PublicShell"],
      ["src/app/(public)/login/page.tsx", "Sign in to GraftVision", "PublicShell"],
      ["src/app/(clinic)/clinic/page.tsx", "Clinic application shell", "ClinicShell"],
      ["src/app/(platform)/platform/page.tsx", "Platform administration", "PlatformShell"],
    ],
    title: "GraftVision Web",
  },
];

const requiredFallbackFiles = ["error.tsx", "global-error.tsx", "loading.tsx", "not-found.tsx"];
const prohibitedRouteDirectoryNames = new Set([
  "ai",
  "dashboard",
  "dashboards",
  "hairline",
  "procedures",
  "reports",
]);

async function exists(relativePath) {
  try {
    await access(path.join(rootDirectory, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(rootDirectory, relativePath), "utf8");
}

async function listDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    directories.push(entryPath, ...(await listDirectories(entryPath)));
  }

  return directories;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

for (const application of applications) {
  const applicationRoot = `apps/${application.name}`;
  const appDirectory = `${applicationRoot}/src/app`;
  const layout = await read(`${appDirectory}/layout.tsx`);

  assert(layout.includes('<html lang="en">'), `${application.name}: root language is missing`);
  assert(
    !layout.includes('href="#main-content"'),
    `${application.name}: root layout must not duplicate shell skip navigation`,
  );
  assert(
    layout.includes(`title: "${application.title}"`),
    `${application.name}: metadata title is incorrect`,
  );
  assert(
    layout.includes(`description: "${application.description}"`),
    `${application.name}: metadata description is incorrect`,
  );

  for (const [relativeRoute, identifier, shell] of application.routes) {
    const source = await read(`${applicationRoot}/${relativeRoute}`);
    assert(source.includes(identifier), `${application.name}: ${relativeRoute} is not neutral`);
    assert(source.includes(shell), `${application.name}: ${relativeRoute} bypasses ${shell}`);
    assert(
      !source.includes('"use client"'),
      `${application.name}: ${relativeRoute} must stay server-rendered`,
    );
  }

  for (const fallbackFile of requiredFallbackFiles) {
    const fallback = await read(`${appDirectory}/${fallbackFile}`);
    assert(
      fallback.includes("<h1") ||
        fallback.includes("ErrorState") ||
        fallback.includes("PresentationStage") ||
        (fallbackFile === "loading.tsx" && fallback.includes("LoadingBlock")),
    );
  }

  for (const clientErrorFile of ["error.tsx", "global-error.tsx"]) {
    const source = await read(`${appDirectory}/${clientErrorFile}`);
    assert(
      source.startsWith('"use client";'),
      `${application.name}: ${clientErrorFile} must be client-only`,
    );
    assert(!source.includes("{error."), `${application.name}: ${clientErrorFile} exposes details`);
  }

  assert(!(await exists(`${applicationRoot}/src/middleware.ts`)));
  if (application.name === "web") {
    const proxy = await read(`${applicationRoot}/src/proxy.ts`);
    assert(proxy.includes("refreshAuthSession"));
  } else {
    assert(!(await exists(`${applicationRoot}/src/proxy.ts`)));
  }
  if (application.name === "web") {
    const apiFiles = (await listFiles(path.join(rootDirectory, appDirectory, "api")))
      .map((file) => path.relative(path.join(rootDirectory, appDirectory, "api"), file))
      .sort();
    assert.deepEqual(apiFiles, [
      "model-packages/[modelPackageId]/artifact/route.ts",
      "scan-sessions/[scanSessionId]/capture/route.ts",
      "scan-sessions/[scanSessionId]/media/[assetId]/route.ts",
      "scan-sessions/[scanSessionId]/media/route.ts",
      "scan-sessions/[scanSessionId]/status/route.ts",
      "scan/pair/route.ts",
      "session/activity/route.ts",
      "session/lock/route.ts",
      "session/revoke-all/route.ts",
      "session/revoke/route.ts",
    ]);
  } else {
    assert(!(await exists(`${appDirectory}/api`)), `${application.name}: API work is deferred`);
  }

  const routeDirectories = await listDirectories(path.join(rootDirectory, appDirectory));

  for (const routeDirectory of routeDirectories) {
    assert(
      !prohibitedRouteDirectoryNames.has(path.basename(routeDirectory).toLowerCase()),
      `${path.relative(rootDirectory, routeDirectory)}: product route is outside FOUNDATION-003`,
    );
  }
}

const uiManifest = JSON.parse(await read("packages/ui/package.json"));
const uiEntry = await read("packages/ui/src/index.ts");
const uiFoundation = await read("packages/ui/src/foundations/shell-notice.tsx");
const skipNavigation = await read("packages/ui/src/shells/skip-navigation.tsx");

assert.equal(uiManifest.exports["."].import, "./src/index.ts");
assert(uiEntry.includes("ShellNotice"));
assert(!uiEntry.includes("*"), "The UI package must use explicit exports");
assert(uiFoundation.includes('<main className="shell-notice" id="main-content"'));
assert(skipNavigation.includes("href={`#${targetId}`}"));

const authEntry = await read("packages/auth/src/index.ts");
const authServerEntry = await read("packages/auth/src/server.ts");
const databaseEntry = await read("packages/database/src/index.ts");
const databaseServerEntry = await read("packages/database/src/server.ts");

assert(
  !authEntry.includes('import "server-only";'),
  "The shared auth entry must remain client-safe",
);
assert(authServerEntry.includes('import "server-only";'));
assert(databaseEntry.includes('import "server-only";'));
assert(databaseServerEntry.includes('import "server-only";'));

for (const packageName of ["auth", "config", "database", "types", "ui"]) {
  const manifest = JSON.parse(await read(`packages/${packageName}/package.json`));
  assert(manifest.exports, `${packageName}: explicit exports are required`);
  assert(
    !JSON.stringify(manifest.exports).includes("*"),
    `${packageName}: wildcard exports are prohibited`,
  );
}

console.log(
  "Application and package shell policy is valid: neutral routes, metadata, fallbacks, accessibility foundations, explicit exports, and client/server markers.",
);
