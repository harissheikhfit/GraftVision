import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-consultation-foundation": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-consultation-foundation"]) {
    throw new Error("Missing --confirm-local-consultation-foundation flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Consultation foundation integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/consultation_foundation.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Consultation foundation integration test passed.");
}

run().catch((error) => {
  console.error("Consultation foundation integration failed:", error);
  process.exit(1);
});
