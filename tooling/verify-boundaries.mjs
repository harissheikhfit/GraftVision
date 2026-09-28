import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const workspaces = [
  { kind: "app", name: "@graftvision/present", relativeRoot: "apps/present" },
  { kind: "app", name: "@graftvision/scan", relativeRoot: "apps/scan" },
  { kind: "app", name: "@graftvision/web", relativeRoot: "apps/web" },
  { kind: "package", name: "@graftvision/auth", relativeRoot: "packages/auth" },
  { kind: "package", name: "@graftvision/config", relativeRoot: "packages/config" },
  { kind: "package", name: "@graftvision/database", relativeRoot: "packages/database" },
  { kind: "package", name: "@graftvision/types", relativeRoot: "packages/types" },
  { kind: "package", name: "@graftvision/ui", relativeRoot: "packages/ui" },
].map((workspace) => ({
  ...workspace,
  absoluteRoot: path.join(rootDirectory, workspace.relativeRoot),
}));

const workspaceByName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));

const allowedWorkspaceDependencies = new Map([
  [
    "@graftvision/present",
    new Set(["@graftvision/auth", "@graftvision/config", "@graftvision/types", "@graftvision/ui"]),
  ],
  [
    "@graftvision/scan",
    new Set(["@graftvision/auth", "@graftvision/config", "@graftvision/types", "@graftvision/ui"]),
  ],
  [
    "@graftvision/web",
    new Set([
      "@graftvision/auth",
      "@graftvision/config",
      "@graftvision/database",
      "@graftvision/types",
      "@graftvision/ui",
    ]),
  ],
  [
    "@graftvision/auth",
    new Set(["@graftvision/config", "@graftvision/database", "@graftvision/types"]),
  ],
  ["@graftvision/config", new Set(["@graftvision/types"])],
  ["@graftvision/database", new Set(["@graftvision/config", "@graftvision/types"])],
  ["@graftvision/types", new Set()],
  ["@graftvision/ui", new Set(["@graftvision/config", "@graftvision/types"])],
]);

const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const serverOnlySpecifiers = new Set([
  "@graftvision/auth/server",
  "@graftvision/config/env/auth",
  "@graftvision/config/env/database",
  "@graftvision/config/env/server",
  "@graftvision/database",
]);
const requiredServerMarkers = [
  "packages/auth/src/server.ts",
  "packages/auth/src/server/client.ts",
  "packages/auth/src/server/current-user.ts",
  "packages/auth/src/server/index.ts",
  "packages/auth/src/server/logout.ts",
  "packages/auth/src/server/proxy.ts",
  "packages/auth/src/server/session.ts",
  "packages/config/src/env/auth.ts",
  "packages/config/src/env/database.ts",
  "packages/config/src/env/server.ts",
  "packages/database/src/index.ts",
  "packages/database/src/auth-identity.ts",
  "packages/database/src/audit/audit-error.ts",
  "packages/database/src/audit/audit-event.ts",
  "packages/database/src/audit/audit-metadata.ts",
  "packages/database/src/audit/audit-types.ts",
  "packages/database/src/audit/index.ts",
  "packages/database/src/storage/index.ts",
  "packages/database/src/storage/storage-key.ts",
  "packages/database/src/tenant/index.ts",
  "packages/database/src/tenant/tenant-context.ts",
  "packages/database/src/tenant/tenant-errors.ts",
  "packages/database/src/tenant/tenant-transaction.ts",
  "packages/database/src/tenant/tenant-types.ts",
];

function normalisePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function workspaceNameFromSpecifier(specifier) {
  if (!specifier.startsWith("@graftvision/")) {
    return undefined;
  }

  const [, packageName] = specifier.split("/");
  return packageName ? `@graftvision/${packageName}` : undefined;
}

function getWorkspaceForPath(filePath) {
  return workspaces.find(
    (workspace) =>
      filePath === workspace.absoluteRoot ||
      filePath.startsWith(`${workspace.absoluteRoot}${path.sep}`),
  );
}

function isClientSafeFile(relativeFile, source) {
  return (
    relativeFile.startsWith("packages/ui/src/") ||
    relativeFile === "packages/config/src/env/client.ts" ||
    /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*["']use client["'];/u.test(source)
  );
}

function verifyExtractionTests() {
  const allowed = [
    {
      code: 'import type { SomeType } from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import type {\n  SomeType\n} from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import { type SomeType as Other } from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
  ];

  const denied = [
    {
      code: 'import { SomeType } from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import { type SomeType, OtherValue } from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import DefaultValue from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import * as Namespace from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    { code: 'import "@graftvision/database";', specifier: "@graftvision/database" },
    {
      code: 'const mod = await import("@graftvision/database");',
      specifier: "@graftvision/database",
    },
    { code: 'const mod = require("@graftvision/database");', specifier: "@graftvision/database" },
    {
      code: 'export { SomeType } from "@graftvision/database";',
      specifier: "@graftvision/database",
    },
    {
      code: 'import { Something } from "packages/database/src/index.ts";',
      specifier: "packages/database/src/index.ts",
    },
    {
      code: 'const str = "import type { SomeType } from \\"@graftvision/database\\"";',
      specifier: null,
    }, // shouldn't parse string as import
  ];

  for (const { code, specifier } of allowed) {
    const imports = extractImportSpecifiers(code);
    const result = imports.find((i) => i.specifier === specifier);
    if (!result || !result.isTypeOnly) {
      console.error(`Boundary test failed! Allowed case was not considered type-only:\\n${code}`);
      process.exit(1);
    }
  }

  for (const { code, specifier } of denied) {
    const imports = extractImportSpecifiers(code);
    if (specifier === null) {
      if (imports.length > 0) {
        console.error(
          `Boundary test failed! Denied case extracted an import when it shouldn't:\\n${code}`,
        );
        process.exit(1);
      }
      continue;
    }
    const result = imports.find((i) => i.specifier === specifier);
    if (result && result.isTypeOnly) {
      console.error(
        `Boundary test failed! Denied case was incorrectly considered type-only:\\n${code}`,
      );
      process.exit(1);
    }
  }
}

function extractImportSpecifiers(source) {
  const sourceFile = ts.createSourceFile("temp.ts", source, ts.ScriptTarget.Latest, true);
  const imports = [];

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;

        let isTypeOnly = false;
        if (node.importClause) {
          if (node.importClause.isTypeOnly) {
            isTypeOnly = true;
          } else if (
            !node.importClause.name &&
            node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
          ) {
            const elements = node.importClause.namedBindings.elements;
            if (elements.length > 0 && elements.every((element) => element.isTypeOnly)) {
              isTypeOnly = true;
            }
          }
        }

        imports.push({ specifier, isTypeOnly });
      }
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        let isTypeOnly = node.isTypeOnly;
        if (!isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)) {
          const elements = node.exportClause.elements;
          if (elements.length > 0 && elements.every((element) => element.isTypeOnly)) {
            isTypeOnly = true;
          }
        }
        imports.push({ specifier, isTypeOnly });
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({ specifier: node.arguments[0].text, isTypeOnly: false });
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({ specifier: node.arguments[0].text, isTypeOnly: false });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function auditImport({ filePath, source, specifier, isTypeOnly, workspace }) {
  const violations = [];
  const relativeFile = normalisePath(path.relative(rootDirectory, filePath));

  if (
    (specifier.endsWith("/src") || specifier.includes("/src/")) &&
    (specifier.startsWith("@graftvision/") || specifier.startsWith("packages/"))
  ) {
    violations.push(`${relativeFile}: deep package import "${specifier}" is not a public export`);
  }

  const importedWorkspaceName = workspaceNameFromSpecifier(specifier);
  const importedWorkspace = importedWorkspaceName
    ? workspaceByName.get(importedWorkspaceName)
    : undefined;

  if (importedWorkspace && importedWorkspace.name !== workspace.name) {
    const allowedDependencies = allowedWorkspaceDependencies.get(workspace.name);

    if (!allowedDependencies?.has(importedWorkspace.name)) {
      violations.push(
        `${relativeFile}: ${workspace.name} cannot import prohibited workspace ${importedWorkspace.name}`,
      );
    }

    if (importedWorkspace.kind === "app") {
      violations.push(`${relativeFile}: applications cannot import another application`);
    }
  }

  if (
    !isTypeOnly &&
    isClientSafeFile(relativeFile, source) &&
    (serverOnlySpecifiers.has(specifier) ||
      [...serverOnlySpecifiers].some((serverSpecifier) =>
        specifier.startsWith(`${serverSpecifier}/`),
      ))
  ) {
    violations.push(`${relativeFile}: client-safe code cannot import server-only "${specifier}"`);
  }

  if (specifier.startsWith(".")) {
    const resolvedPath = path.resolve(path.dirname(filePath), specifier);
    const targetWorkspace = getWorkspaceForPath(resolvedPath);
    const possibleTargetFiles = [
      resolvedPath,
      `${resolvedPath}.ts`,
      `${resolvedPath}.tsx`,
      path.join(resolvedPath, "index.ts"),
      path.join(resolvedPath, "index.tsx"),
    ].map(normalisePath);
    const privilegedInternalFiles = requiredServerMarkers.map((relativePath) =>
      normalisePath(path.join(rootDirectory, relativePath)),
    );

    if (targetWorkspace && targetWorkspace.name !== workspace.name) {
      violations.push(
        `${relativeFile}: relative import "${specifier}" crosses from ${workspace.name} into ${targetWorkspace.name}`,
      );
    }

    if (
      isClientSafeFile(relativeFile, source) &&
      possibleTargetFiles.some((targetFile) => privilegedInternalFiles.includes(targetFile))
    ) {
      violations.push(
        `${relativeFile}: client-safe entry point cannot re-export privileged "${specifier}"`,
      );
    }
  }

  return violations;
}

function findDependencyCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(workspaceName) {
    if (visiting.has(workspaceName)) {
      const cycleStart = stack.indexOf(workspaceName);
      return [...stack.slice(cycleStart), workspaceName];
    }

    if (visited.has(workspaceName)) {
      return undefined;
    }

    visiting.add(workspaceName);
    stack.push(workspaceName);

    for (const dependency of graph.get(workspaceName) ?? []) {
      const cycle = visit(dependency);

      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(workspaceName);
    visited.add(workspaceName);
    return undefined;
  }

  for (const workspaceName of graph.keys()) {
    const cycle = visit(workspaceName);

    if (cycle) {
      return cycle;
    }
  }

  return undefined;
}

async function auditRepository() {
  const violations = [];
  const dependencyGraph = new Map();

  for (const workspace of workspaces) {
    const manifestPath = path.join(workspace.absoluteRoot, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const declaredDependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    };
    const workspaceDependencies = Object.keys(declaredDependencies).filter((dependency) =>
      workspaceByName.has(dependency),
    );

    dependencyGraph.set(workspace.name, new Set(workspaceDependencies));

    for (const dependency of workspaceDependencies) {
      if (!allowedWorkspaceDependencies.get(workspace.name)?.has(dependency)) {
        violations.push(
          `${workspace.relativeRoot}/package.json: ${workspace.name} cannot depend on ${dependency}`,
        );
      }
    }

    const exportsField = manifest.exports;

    if (exportsField && typeof exportsField === "object") {
      for (const [exportName, exportTarget] of Object.entries(exportsField)) {
        if (exportName.includes("*") || JSON.stringify(exportTarget).includes("/src/../")) {
          violations.push(
            `${workspace.relativeRoot}/package.json: package exports must be explicit and cannot traverse internals`,
          );
        }
      }
    }

    const sourceDirectory = path.join(workspace.absoluteRoot, "src");
    const sourceFiles = await listSourceFiles(sourceDirectory);

    for (const filePath of sourceFiles) {
      const source = await readFile(filePath, "utf8");

      for (const { specifier, isTypeOnly } of extractImportSpecifiers(source)) {
        violations.push(...auditImport({ filePath, source, specifier, isTypeOnly, workspace }));
      }
    }
  }

  const dependencyCycle = findDependencyCycle(dependencyGraph);

  if (dependencyCycle) {
    violations.push(`workspace dependency cycle: ${dependencyCycle.join(" -> ")}`);
  }

  for (const relativeFile of requiredServerMarkers) {
    const source = await readFile(path.join(rootDirectory, relativeFile), "utf8");

    if (!source.includes('import "server-only";')) {
      violations.push(`${relativeFile}: required server-only marker is missing`);
    }
  }

  return violations;
}

function verifyFixture(fixtureName) {
  const fixtureWorkspace = workspaceByName.get("@graftvision/web");

  if (!fixtureWorkspace) {
    throw new Error("Boundary fixture workspace is unavailable.");
  }

  const fixtures = {
    "client-server": {
      expectedText: "client-safe code cannot import server-only",
      filePath: path.join(fixtureWorkspace.absoluteRoot, "src", "__boundary_fixture.ts"),
      source: '"use client";\nimport "@graftvision/database";\n',
      specifier: "@graftvision/database",
    },
    "client-config-server": {
      expectedText: "client-safe code cannot import server-only",
      filePath: path.join(fixtureWorkspace.absoluteRoot, "src", "__boundary_fixture.ts"),
      source: '"use client";\nimport "@graftvision/config/env/server";\n',
      specifier: "@graftvision/config/env/server",
    },
    "deep-import": {
      expectedText: "deep package import",
      filePath: path.join(fixtureWorkspace.absoluteRoot, "src", "__boundary_fixture.ts"),
      source: 'import "@graftvision/database/src/index";\n',
      specifier: "@graftvision/database/src/index",
    },
  };
  const fixture = fixtures[fixtureName];

  if (!fixture) {
    throw new Error(`Unknown boundary fixture "${fixtureName}".`);
  }

  const violations = auditImport({ ...fixture, workspace: fixtureWorkspace });

  if (!violations.some((violation) => violation.includes(fixture.expectedText))) {
    throw new Error(`Boundary fixture "${fixtureName}" was not rejected as expected.`);
  }

  console.log(`Boundary fixture "${fixtureName}" was rejected as expected.`);
}

const fixtureArgument = process.argv.find((argument) => argument.startsWith("--fixture="));

if (fixtureArgument) {
  verifyFixture(fixtureArgument.slice("--fixture=".length));
} else {
  verifyExtractionTests();
  const violations = await auditRepository();

  if (violations.length > 0) {
    console.error("Workspace boundary verification failed:");

    for (const violation of violations) {
      console.error(`- ${violation}`);
    }

    process.exitCode = 1;
  } else {
    console.log("Workspace dependency and client/server boundaries are valid.");
  }
}
