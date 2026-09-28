import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({ options: { "confirm-local-scan-pairing": { type: "boolean" } } });

if (!values["confirm-local-scan-pairing"])
  throw new Error("Missing --confirm-local-scan-pairing flag.");
if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
  throw new Error("Scan pairing integration is permitted only locally.");
}
try {
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/scan_session.test.sql"],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Scan pairing integration passed using synthetic rollback-only assertions.");
} catch (error) {
  console.error("Scan pairing integration failed safely.");
  if (error?.stdout) process.stdout.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  process.exit(1);
}
