import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

if (!process.argv.includes("--confirm-local-auth-propagation")) {
  console.error(`${RED}Error: Missing --confirm-local-auth-propagation flag.${RESET}`);
  process.exit(1);
}

const envPath = path.resolve(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
  console.error(`${RED}Error: .env file is missing. Are you running in local?${RESET}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
if (!envContent.includes("APP_ENV=local")) {
  console.error(`${RED}Error: APP_ENV is not 'local'. Aborting.${RESET}`);
  process.exit(1);
}

console.log("Running synthetic auth propagation harness...");

try {
  execSync("supabase test db supabase/tests/database/auth_propagation.test.sql", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  console.log(`${GREEN}Auth propagation tests passed.${RESET}`);
} catch {
  console.error(`${RED}Auth propagation tests failed.${RESET}`);
  process.exit(1);
}
