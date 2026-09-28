import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    "confirm-local-doctor-authority": { type: "boolean" },
  },
});

async function run() {
  if (!values["confirm-local-doctor-authority"]) {
    throw new Error("Missing --confirm-local-doctor-authority flag.");
  }

  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error(
      "Doctor authority integration is permitted only in local or test environments.",
    );
  }

  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/doctor_authority.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Doctor authority integration test passed.");
}

run().catch((error) => {
  console.error("Doctor authority integration failed:", error);
  process.exit(1);
});
