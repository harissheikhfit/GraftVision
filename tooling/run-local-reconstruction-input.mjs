import { spawnSync } from "node:child_process";
if (!process.argv.includes("--confirm-local-reconstruction-input"))
  throw new Error("Refusing to run without --confirm-local-reconstruction-input.");
const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "supabase",
    "test",
    "db",
    "supabase/tests/database/reconstruction_input_preparation.test.sql",
    "--local",
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Reconstruction input preparation integration passed with synthetic protected assertions.",
);
