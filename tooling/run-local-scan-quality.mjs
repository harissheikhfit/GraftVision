import { spawnSync } from "node:child_process";

if (!process.argv.includes("--confirm-local-scan-quality")) {
  throw new Error("Refusing to run without --confirm-local-scan-quality.");
}

const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "supabase",
    "test",
    "db",
    "supabase/tests/database/scan_quality_matrix.test.sql",
    "--local",
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Scan quality matrix and readiness integration passed with synthetic protected assertions.",
);
