import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-real-inference-poc": { type: "boolean" } },
});

if (!values["confirm-local-real-inference-poc"])
  throw new Error("Missing --confirm-local-real-inference-poc flag.");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const { stdout, stderr } = await execFileAsync(
    "corepack",
    ["pnpm", "vitest", "run", "src/run-real-inference-poc.test.ts", "--passWithNoTests"],
    {
      cwd: path.join(rootDir, "packages/database"),
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, CONFIRM_LOCAL_REAL_INFERENCE_POC: "1" },
    },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log("Real inference POC completed successfully.");
} catch (error) {
  console.error("Real inference POC failed.");
  if (error?.stdout) process.stdout.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  process.exit(1);
}
