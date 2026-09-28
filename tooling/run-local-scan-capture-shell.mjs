import { spawnSync } from "node:child_process";

if (!process.argv.includes("--confirm-local-scan-capture-shell")) {
  throw new Error("Refusing to run without --confirm-local-scan-capture-shell.");
}
const result = spawnSync(
  "corepack",
  ["pnpm", "supabase", "test", "db", "supabase/tests/database/scan_session.test.sql", "--local"],
  { cwd: process.cwd(), stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Scan capture-shell integration passed using synthetic rollback-only assertions.");
