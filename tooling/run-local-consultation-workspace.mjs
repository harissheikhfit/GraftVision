import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-consultation-workspace": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-consultation-workspace"]) {
    throw new Error("Missing --confirm-local-consultation-workspace flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Consultation workspace integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "corepack",
    ["pnpm", "--filter", "@graftvision/web", "test"],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Consultation workspace integration test passed.");
}

run().catch((error) => {
  console.error("Consultation workspace integration failed safely.");
  if (error?.stdout) process.stdout.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  process.exit(1);
});
