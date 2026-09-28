import { runWorkspaceVerification } from "./foundation-verification.mjs";

const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision workspace verifier

Usage:
  corepack pnpm verify:workspace

Checks:
  - Node, Corepack-pinned pnpm, and manifest version contracts
  - All nine expected roots, names, exports, scripts, and app ports
  - Lockfile, tracked-artifact, secret, provider-variable, and dependency hygiene
  - Explicit cleanup safety

This command is read-only and does not install dependencies or remove outputs.`);
  process.exit(0);
}

try {
  const steps = [
    "Tool versions and manifest contract",
    "Nine-root workspace structure",
    "Repository and dependency hygiene",
    "Cleanup safety",
  ];

  console.log("Verifying GraftVision workspace foundation:");

  for (const [index, step] of steps.entries()) {
    console.log(`  ${index + 1}. ${step}`);
  }

  await runWorkspaceVerification();
  console.log("Workspace verification passed.");
} catch (error) {
  console.error(`Workspace verification failed: ${error.message}`);
  process.exitCode = 1;
}
