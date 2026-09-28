import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-consultation-gate": { type: "boolean" } },
});

async function run() {
  if (!values["confirm-local-consultation-gate"]) {
    throw new Error("Missing --confirm-local-consultation-gate flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Consultation Gate integration is permitted only locally.");
  }

  const testsDir = resolve(process.cwd(), "supabase", "tests", "database");
  const files = readdirSync(testsDir);

  const targetPrefixes = [
    "consultation_foundation",
    "consultation_workspace",
    "consultation_concurrency",
    "consultation_clinical_history",
    "consultation_preliminary_assessment",
    "consultation_completion",
    "consultation_gate",
  ];

  const testsToRun = files
    .filter((f) => f.endsWith(".test.sql") && targetPrefixes.some((p) => f.startsWith(p)))
    .map((f) => "supabase/tests/database/" + f);

  if (testsToRun.length === 0) {
    throw new Error("No test files resolved");
  }

  const { stdout, stderr } = await execFileAsync("supabase", ["test", "db", ...testsToRun], {
    cwd: process.cwd(),
  });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Consultation Gate integration passed using synthetic rollback-only assertions.");
}

run().catch((error) => {
  console.error("Consultation Gate integration failed.");
  if (error && typeof error === "object" && "stdout" in error) {
    process.stdout.write(String(error.stdout));
  }
  if (error && typeof error === "object" && "stderr" in error) {
    process.stderr.write(String(error.stderr));
  }
  process.exit(1);
});
