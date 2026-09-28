import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const authRequire = createRequire(path.join(root, "packages/auth/package.json"));
const databaseRequire = createRequire(path.join(root, "packages/database/package.json"));
const { createClient } = authRequire("@supabase/supabase-js");
const { Pool } = databaseRequire("pg");

function fail(message) {
  throw new Error(message);
}

async function hiddenPassword() {
  if (!process.stdin.isTTY) fail("Interactive password entry is required.");
  process.stdout.write("Owner password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (key) => {
      if (key === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Bootstrap cancelled."));
      } else if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (key === "\u007f") {
        value = value.slice(0, -1);
      } else {
        const codePoint = key.codePointAt(0);
        if (codePoint !== undefined && codePoint > 31 && codePoint !== 127) value += key;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const environment = args[args.indexOf("--environment") + 1];
  const emailArg = args[args.indexOf("--email") + 1];
  if (!["local", "production"].includes(environment)) {
    fail("Use --environment local or production.");
  }
  const email = String(emailArg || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail("A valid owner email is required.");
  if (environment === "production") {
    fail("Production owner bootstrap is disabled.");
  }

  const { stdout } = await execFileAsync("supabase", ["status", "-o", "json"], { cwd: root });
  const status = JSON.parse(stdout);
  const api = new URL(status.API_URL);
  const database = new URL(status.DB_URL);
  if (
    environment === "local" &&
    (!["127.0.0.1", "::1", "localhost"].includes(api.hostname) ||
      !["127.0.0.1", "::1", "localhost"].includes(database.hostname))
  ) {
    fail("Local bootstrap requires loopback endpoints.");
  }
  if (environment === "production") {
    fail("Production bootstrap requires the separately approved deployment operator.");
  }

  const password = await hiddenPassword();
  if (password.length < 12) fail("Password does not meet the minimum length.");
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listed.error) fail("Provider identities could not be inspected.");
  let user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (user) {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password,
      user_metadata: {},
    });
    if (updated.error) fail("Provider identity could not be verified.");
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {},
    });
    if (created.error || !created.data.user) fail("Provider identity could not be created.");
    user = created.data.user;
  }

  const pool = new Pool({ connectionString: status.DB_URL, max: 1 });
  try {
    await pool.query("begin");
    await pool.query(
      "select graftvision_private.bootstrap_first_platform_owner($1::uuid,$2::text)",
      [user.id, email],
    );
    await pool.query("commit");
  } catch {
    await pool.query("rollback").catch(() => undefined);
    fail("Owner bootstrap was refused.");
  } finally {
    await pool.end();
  }
  console.log("Platform Owner bootstrap completed without exposing credentials.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Platform Owner bootstrap failed.");
  process.exitCode = 1;
});
