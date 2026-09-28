import { spawnSync } from "node:child_process";

if (!process.argv.includes("--confirm-local-scan-media-upload")) {
  throw new Error("Refusing to run without --confirm-local-scan-media-upload.");
}
const result = spawnSync(
  "corepack",
  ["pnpm", "supabase", "test", "db", "supabase/tests/database/scan_session.test.sql", "--local"],
  { cwd: process.cwd(), stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Scan media-upload integration passed with synthetic protected scan-session assertions.",
);
