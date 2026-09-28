import {
  auditFreshCopy,
  captureProtectedSnapshot,
  compareProtectedSnapshots,
  createFreshCopy,
  removeFreshCopy,
  repositoryRoot,
  runCorepackPnpm,
  runWorkspaceVerification,
  validateBuildOutputs,
} from "./foundation-verification.mjs";

const freshMode = process.argv.includes("--fresh");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => !["--fresh", "--help", "-h"].includes(argument));

if (helpRequested) {
  console.log(`GraftVision clean-build verifier

Usage:
  corepack pnpm verify:clean-build   Standard mode
  corepack pnpm verify:fresh-install Fresh-install mode

Standard mode:
  Uses current node_modules, verifies the workspace, removes only explicit generated
  outputs through the existing clean scripts, runs the full root check, and confirms
  all app/package build outputs. It does not install or use the network.

Fresh-install mode:
  Creates an allowlisted copy under the operating-system temporary directory, excludes
  .git, docs, node_modules, local env files, caches, and outputs, installs from the frozen
  lockfile through Corepack pnpm 11.17.0, runs the standard verifier, and removes the copy.

Neither mode deletes source, documentation, local environment files, lockfiles, manifests,
assets, untracked work, Git metadata, or the developer's node_modules.`);
  process.exit(0);
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(", ")}. Use --help for usage.`);
  process.exit(2);
}

async function runStandard(rootDirectory) {
  console.log("[1/5] Verify tool, workspace, hygiene, and cleanup policies");
  await runWorkspaceVerification(rootDirectory);

  console.log("[2/5] Capture protected working-file snapshot");
  const before = await captureProtectedSnapshot(rootDirectory);

  console.log("[3/5] Remove only explicit generated outputs");
  runCorepackPnpm(["clean"], {
    cwd: rootDirectory,
    stepName: "Generated-output cleanup",
  });

  console.log("[4/5] Run the complete deterministic foundation check");
  runCorepackPnpm(["check"], {
    cwd: rootDirectory,
    stepName: "Foundation quality check",
  });

  console.log("[5/5] Verify all build outputs and protected files");
  await validateBuildOutputs(rootDirectory);
  const after = await captureProtectedSnapshot(rootDirectory);
  compareProtectedSnapshots(before, after);
}

async function runFresh() {
  let temporaryRoot;

  try {
    console.log("[1/5] Create explicit temporary source/configuration copy");
    temporaryRoot = await createFreshCopy(repositoryRoot);

    console.log("[2/5] Audit temporary-copy inclusions and exclusions");
    await auditFreshCopy(temporaryRoot);

    console.log("[3/5] Install exactly from pnpm-lock.yaml with Corepack");
    runCorepackPnpm(["install", "--frozen-lockfile"], {
      cwd: temporaryRoot,
      stepName: "Fresh frozen-lockfile installation",
    });

    console.log("[4/5] Run standard clean-build verification in temporary copy");
    await runStandard(temporaryRoot);

    console.log("[5/5] Fresh-install verification passed");
  } finally {
    if (temporaryRoot) {
      console.log("Cleaning temporary verification copy");
      await removeFreshCopy(temporaryRoot);
    }
  }
}

try {
  if (freshMode) {
    await runFresh();
  } else {
    await runStandard(repositoryRoot);
    console.log("Standard clean-build verification passed.");
  }
} catch (error) {
  console.error(
    `${freshMode ? "Fresh-install" : "Standard clean-build"} verification failed: ${error.message}`,
  );
  process.exitCode = 1;
}
