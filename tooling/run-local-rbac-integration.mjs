import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { values } = parseArgs({
  options: {
    "confirm-local-rbac": { type: "boolean" },
  },
});

async function run() {
  if (!values["confirm-local-rbac"]) {
    console.error("Missing --confirm-local-rbac flag.");
    process.exit(1);
  }

  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("RBAC integration is permitted only in local or test environments.");
  }

  for (const testFile of [
    "supabase/tests/database/rbac_authority.test.sql",
    "supabase/tests/database/rbac_boundary.test.sql",
  ]) {
    const { stdout, stderr } = await execFileAsync("supabase", ["test", "db", testFile], {
      cwd: process.cwd(),
    });
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }
  console.log("RBAC live integration test passed.");
}

run().catch((error) => {
  console.error("Integration test failed:", error);
  process.exit(1);
});
