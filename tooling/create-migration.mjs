import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMigration } from "./migration-policy.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(rootDirectory, "supabase/migrations");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log(`GraftVision migration creation helper

Usage:
  corepack pnpm migration:create descriptive_name

Creates a comment-only UTC-timestamped SQL file in supabase/migrations. It validates
lowercase snake_case, refuses timestamp collisions, and never connects to a database.`);
  process.exit(0);
}

const descriptions = process.argv.slice(2);

if (descriptions.length !== 1) {
  console.error("Migration creation failed: provide exactly one lowercase snake_case description.");
  process.exitCode = 1;
} else {
  try {
    const result = await createMigration({
      description: descriptions[0],
      directory: migrationsDirectory,
    });

    console.log(`Created ${path.relative(rootDirectory, result.destination)}.`);
    console.log("Add reviewed PostgreSQL SQL, complete the header, and run the policy verifier.");
  } catch (error) {
    console.error(`Migration creation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
