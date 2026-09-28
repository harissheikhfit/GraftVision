import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-consultation-clinical-history": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-consultation-clinical-history"]) {
    throw new Error("Missing guarded local confirmation.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Clinical-history integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/consultation_clinical_history.test.sql"],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Consultation clinical-history integration passed with synthetic data.");
}

run().catch((error) => {
  console.error("Consultation clinical-history integration failed safely.");
  if (error?.stdout) process.stdout.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  process.exit(1);
});
