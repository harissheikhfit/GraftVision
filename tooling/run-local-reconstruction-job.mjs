import { spawnSync } from "node:child_process";

if (!process.argv.includes("--confirm-local-reconstruction-job")) {
  throw new Error("Refusing to run without --confirm-local-reconstruction-job.");
}

const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "supabase",
    "test",
    "db",
    "supabase/tests/database/reconstruction_job.test.sql",
    "--local",
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Reconstruction job lifecycle integration passed with synthetic protected assertions.");
