import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-patient-consent": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-patient-consent"]) {
    throw new Error("Missing --confirm-local-patient-consent flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Patient consent integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/patient_consent.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Patient privacy acknowledgement integration test passed.");
}

run().catch((error) => {
  console.error("Patient privacy acknowledgement integration failed:", error);
  process.exit(1);
});
