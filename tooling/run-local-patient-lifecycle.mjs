import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-patient-lifecycle": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-patient-lifecycle"]) {
    throw new Error("Missing --confirm-local-patient-lifecycle flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Patient lifecycle integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/patient_lifecycle.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Patient lifecycle integration test passed.");
}

run().catch((error) => {
  console.error("Patient lifecycle integration failed:", error);
  process.exit(1);
});
