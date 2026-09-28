if (!process.argv.includes("--confirm-local-reconstruction-engine")) {
  throw new Error("Refusing to run without --confirm-local-reconstruction-engine.");
}

const command = [
  "corepack pnpm supabase test db",
  "supabase/tests/database/reconstruction_engine_output.test.sql",
  "--local",
].join(" ");

const { execSync } = await import("node:child_process");
execSync(command, { cwd: new URL("..", import.meta.url), stdio: "inherit" });
console.log("Reconstruction engine integration passed with synthetic non-clinical assertions.");
