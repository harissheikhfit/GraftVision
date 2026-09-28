import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-patient-profile": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-patient-profile"]) {
    throw new Error("Missing --confirm-local-patient-profile flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Patient profile integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/patient_profile.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Patient profile integration test passed.");
}

run().catch((error) => {
  console.error("Patient profile integration failed:", error);
  process.exit(1);
});
