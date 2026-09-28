import { spawnSync } from "node:child_process";
if (!process.argv.includes("--confirm-local-reconstruction-worker-gateway"))
  throw new Error("Refusing to run without --confirm-local-reconstruction-worker-gateway.");
const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "supabase",
    "test",
    "db",
    "supabase/tests/database/reconstruction_worker_gateway.test.sql",
    "--local",
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Reconstruction worker gateway integration passed with lease-scoped synthetic assertions.",
);
