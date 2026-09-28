import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-consultation-concurrency": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-consultation-concurrency"]) {
    throw new Error("Missing --confirm-local-consultation-concurrency flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Consultation concurrency integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/consultation_concurrency.test.sql"],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Consultation concurrency integration test passed.");
}

run().catch((error) => {
  console.error("Consultation concurrency integration failed safely.");
  if (error?.stdout) process.stdout.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  process.exit(1);
});
