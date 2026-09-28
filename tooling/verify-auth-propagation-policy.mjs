import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function checkFile(filePath, regexes, errorMessage) {
  if (!fs.existsSync(filePath)) {
    console.log(`${YELLOW}Warning: ${filePath} not found. Skipping.${RESET}`);
    return true;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  for (const regex of regexes) {
    if (regex.test(content)) {
      console.error(`${RED}Error: ${errorMessage} in ${filePath}${RESET}`);
      console.error(`Matched pattern: ${regex}`);
      return false;
    }
  }
  return true;
}

let hasError = false;

// 1. No read-then-revoke in TS
const sessionTsPath = path.join(rootDir, "packages", "database", "src", "session.ts");
const registryTsPath = path.join(rootDir, "packages", "auth", "src", "server", "registry.ts");

if (
  !checkFile(
    sessionTsPath,
    [/platformAuthorizationVersion !==/i, /clinicAuthorizationVersion !==/i],
    "TS should not read and compare authorization versions manually. This must be an atomic database operation.",
  )
) {
  hasError = true;
}

if (
  !checkFile(
    registryTsPath,
    [
      /authorization_version/i,
      /platformAuthorizationVersion !==/i,
      /clinicAuthorizationVersion !==/i,
    ],
    "TS should not read and compare authorization versions manually. This must be an atomic database operation.",
  )
) {
  hasError = true;
}

if (hasError) {
  console.error(`${RED}Auth propagation policy check failed.${RESET}`);
  process.exit(1);
}

console.log(`${GREEN}Auth propagation policy check passed.${RESET}`);
