import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-platform-admin": { type: "boolean" } },
});
if (!values["confirm-local-platform-admin"]) {
  throw new Error("Missing --confirm-local-platform-admin flag.");
}
if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
  throw new Error("Platform admin integration is permitted only locally.");
}
try {
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/platform_admin.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Platform administration integration passed using synthetic rollback-only data.");
} catch (error) {
  console.error("Platform administration integration failed.");
  if (error && typeof error === "object" && "stdout" in error)
    process.stdout.write(String(error.stdout));
  if (error && typeof error === "object" && "stderr" in error)
    process.stderr.write(String(error.stderr));
  process.exitCode = 1;
}
