import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    "confirm-local-clinic-lifecycle": { type: "boolean" },
  },
});

async function run() {
  if (!values["confirm-local-clinic-lifecycle"]) {
    throw new Error("Missing --confirm-local-clinic-lifecycle flag.");
  }

  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error(
      "Clinic lifecycle integration is permitted only in local or test environments.",
    );
  }

  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/clinic_lifecycle.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Clinic lifecycle integration test passed.");
}

run().catch((error) => {
  console.error("Clinic lifecycle integration failed:", error);
  process.exit(1);
});
