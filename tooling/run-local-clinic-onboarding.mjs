import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-clinic-onboarding": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-clinic-onboarding"]) {
    throw new Error("Missing --confirm-local-clinic-onboarding flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Clinic onboarding integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/clinic_onboarding.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Clinic onboarding integration test passed.");
}

run().catch((error) => {
  console.error("Clinic onboarding integration failed:", error);
  process.exit(1);
});
