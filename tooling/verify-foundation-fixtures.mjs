import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  auditFreshCopy,
  compareProtectedSnapshots,
  createFreshCopy,
  isFreshCopyPathAllowed,
  repositoryRoot,
  removeFreshCopy,
  scanProviderVariables,
  scanSecretLikeContent,
  validateChildResult,
  validateCleanupSafety,
  validateNodeVersion,
  validatePnpmVersion,
  validateRepositoryHygiene,
  validateWorkspaceStructure,
} from "./foundation-verification.mjs";

const fixtureArgument = process.argv.find((argument) => argument.startsWith("--fixture="));
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision foundation verifier fixtures

Usage:
  corepack pnpm verify:foundation-fixtures
  node tooling/verify-foundation-fixtures.mjs --fixture=<name>

Fixtures:
  wrong-node, wrong-pnpm, multiple-lockfiles, missing-workspace,
  duplicate-package-name, unsafe-cleanup, copy-exclusions,
  provider-variable, secret-like-content, clean-build-result

Fixtures use operating-system temporary directories and expect the verifier to reject
unsafe or inconsistent input. They do not modify the working repository.`);
  process.exit(0);
}

async function expectRejection(name, action, expectedText) {
  try {
    await action();
  } catch (error) {
    if (!error.message.includes(expectedText)) {
      throw new Error(`${name}: expected "${expectedText}", received "${error.message}".`);
    }

    return;
  }

  throw new Error(`${name}: verifier accepted an invalid fixture.`);
}

async function withRepositoryFixture(action) {
  const fixtureRoot = await createFreshCopy(repositoryRoot);

  try {
    await action(fixtureRoot);
  } finally {
    await removeFreshCopy(fixtureRoot);
  }
}

const fixtures = {
  "clean-build-result": async () => {
    await expectRejection(
      "clean-build-result",
      () => validateChildResult({ error: undefined, signal: null, status: 7 }, "fixture build"),
      "exit code 7",
    );
  },
  "copy-exclusions": async () => {
    for (const excludedPath of [
      ".git/config",
      ".env.local",
      "node_modules/example/index.js",
      "apps/web/.next/server.js",
      "packages/ui/dist/index.d.ts",
      "coverage/index.html",
      ".turbo/cache/item",
    ]) {
      if (isFreshCopyPathAllowed(excludedPath)) {
        throw new Error(`copy-exclusions: unsafe path "${excludedPath}" was allowed.`);
      }
    }

    const freshRoot = await createFreshCopy(repositoryRoot);

    try {
      await auditFreshCopy(freshRoot);
    } finally {
      await removeFreshCopy(freshRoot);
    }
  },
  "duplicate-package-name": async () => {
    await withRepositoryFixture(async (fixtureRoot) => {
      const manifestPath = path.join(fixtureRoot, "packages/types/package.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.name = "@graftvision/ui";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await expectRejection(
        "duplicate-package-name",
        () => validateWorkspaceStructure(fixtureRoot),
        "Duplicate workspace package name",
      );
    });
  },
  "missing-workspace": async () => {
    await withRepositoryFixture(async (fixtureRoot) => {
      await rm(path.join(fixtureRoot, "packages/types/package.json"));
      await expectRejection(
        "missing-workspace",
        () => validateWorkspaceStructure(fixtureRoot),
        "package.json is missing",
      );
    });
  },
  "multiple-lockfiles": async () => {
    await withRepositoryFixture(async (fixtureRoot) => {
      await writeFile(path.join(fixtureRoot, "package-lock.json"), "{}\n");
      await expectRejection(
        "multiple-lockfiles",
        () => validateRepositoryHygiene(fixtureRoot),
        "Exactly one root pnpm-lock.yaml",
      );
    });
  },
  "provider-variable": async () => {
    await expectRejection(
      "provider-variable",
      () => scanProviderVariables("OPENAI_API_KEY=synthetic-but-unapproved"),
      "unapproved provider variable",
    );
  },
  "secret-like-content": async () => {
    await expectRejection(
      "secret-like-content",
      () => scanSecretLikeContent('client_secret="realisticCredentialValue123456"'),
      "secret-like credential",
    );
  },
  "unsafe-cleanup": async () => {
    await withRepositoryFixture(async (fixtureRoot) => {
      const manifestPath = path.join(fixtureRoot, "apps/web/package.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.scripts.clean = "rimraf .next src";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await expectRejection(
        "unsafe-cleanup",
        () => validateCleanupSafety(fixtureRoot),
        "unsafe cleanup target",
      );
    });
  },
  "wrong-node": async () => {
    await expectRejection("wrong-node", () => validateNodeVersion("20.19.0"), "unsupported");
  },
  "wrong-pnpm": async () => {
    await expectRejection("wrong-pnpm", () => validatePnpmVersion("11.9.0"), "unsupported");
  },
};

// Keep the snapshot comparison helper exercised without modifying repository files.
compareProtectedSnapshots(new Map([["fixture", "same"]]), new Map([["fixture", "same"]]));

try {
  if (fixtureArgument) {
    const fixtureName = fixtureArgument.slice("--fixture=".length);
    const fixture = fixtures[fixtureName];

    if (!fixture) {
      throw new Error(`Unknown fixture "${fixtureName}". Use --help for fixture names.`);
    }

    await fixture();
    console.log(`Foundation fixture passed: ${fixtureName}.`);
  } else {
    console.log("Running foundation verifier rejection fixtures:");

    for (const [fixtureName, fixture] of Object.entries(fixtures)) {
      console.log(`- ${fixtureName}`);
      await fixture();
    }

    console.log(`All ${Object.keys(fixtures).length} foundation verifier fixtures passed.`);
  }
} catch (error) {
  console.error(`Foundation fixture verification failed: ${error.message}`);
  process.exitCode = 1;
}
