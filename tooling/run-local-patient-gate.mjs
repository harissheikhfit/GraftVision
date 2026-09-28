import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-patient-gate": { type: "boolean" } },
});
const patientTests = [
  "supabase/tests/database/patient_foundation.test.sql",
  "supabase/tests/database/patient_registration.test.sql",
  "supabase/tests/database/patient_search.test.sql",
  "supabase/tests/database/patient_profile.test.sql",
  "supabase/tests/database/patient_consent.test.sql",
  "supabase/tests/database/patient_lifecycle.test.sql",
  "supabase/tests/database/patient_gate.test.sql",
];

async function run() {
  if (!values["confirm-local-patient-gate"]) {
    throw new Error("Missing --confirm-local-patient-gate flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Patient Gate integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync("supabase", ["test", "db", ...patientTests], {
    cwd: process.cwd(),
  });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Patient Gate integration passed using synthetic rollback-only assertions.");
}

run().catch((error) => {
  console.error("Patient Gate integration failed.");
  if (error && typeof error === "object" && "stdout" in error) {
    process.stdout.write(String(error.stdout));
  }
  if (error && typeof error === "object" && "stderr" in error) {
    process.stderr.write(String(error.stderr));
  }
  process.exit(1);
});
