import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
/* global fetch */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromAuth = createRequire(path.join(rootDirectory, "packages/auth/package.json"));
const { createClient } = requireFromAuth("@supabase/supabase-js");

const confirmationFlag = "--confirm-local-auth-lifecycle";
const webUrl = "http://localhost:3000";

class LocalAuthLifecycleError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalAuthLifecycleError";
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new LocalAuthLifecycleError(message);
  }
}

async function localStatus() {
  const config = await readFile(path.join(rootDirectory, "supabase/config.toml"), "utf8");
  ensure(config.includes('project_id = "graftvision-local"'), "Local project marker is missing.");

  const { stdout } = await execFileAsync("supabase", ["status", "-o", "json"], {
    cwd: rootDirectory,
  });
  const status = JSON.parse(stdout);

  ensure(
    status.API_URL && status.SERVICE_ROLE_KEY && status.ANON_KEY,
    "Local Supabase status incomplete.",
  );

  // Use INBUCKET_URL as the mail endpoint base, defaults to 54324 if not explicitly present.
  const mailUrl = status.INBUCKET_URL || "http://127.0.0.1:54324";
  return { ...status, mailUrl };
}

function adminClient(status) {
  return createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function standardClient(status) {
  return createClient(status.API_URL, status.ANON_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function deleteUserByEmail(admin, emailAddress) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  ensure(!error, "Local lifecycle users could not be inspected.");
  const existing = data.users.find((user) => user.email === emailAddress);

  if (existing) {
    const deletion = await admin.auth.admin.deleteUser(existing.id);
    ensure(!deletion.error, "Existing local lifecycle user could not be reset.");
  }
}

async function captureEmailLink(mailUrl, emailAddress) {
  // First attempt Mailpit API
  let messages = [];
  try {
    const res = await fetch(`${mailUrl}/api/v1/messages`);
    if (res.ok) {
      const data = await res.json();
      messages = data.messages || [];
      const msg = messages.find((m) => m.To && m.To.some((t) => t.Address === emailAddress));
      if (msg) {
        const detailRes = await fetch(`${mailUrl}/api/v1/message/${msg.ID}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const content = detail.Text || detail.HTML;
          return extractLink(content);
        }
      }
    }
  } catch {
    // Fall back to Inbucket if Mailpit fails
  }

  // Fallback Inbucket API
  try {
    const res = await fetch(`${mailUrl}/api/v1/mailbox/${emailAddress}`);
    if (res.ok) {
      messages = await res.json();
      if (messages.length > 0) {
        // latest message
        const latest = messages[messages.length - 1];
        const detailRes = await fetch(`${mailUrl}/api/v1/mailbox/${emailAddress}/${latest.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const content = detail.body?.text || detail.body?.html;
          return extractLink(content);
        }
      }
    }
  } catch {
    // ignore
  }

  throw new LocalAuthLifecycleError("Could not capture local email or extract link.");
}

function extractLink(content) {
  // We expect a link going to site URL (localhost:3000) or similar auth verification links
  const regex = /http:\/\/[^\s"'<]+/g;
  const matches = content.match(regex);
  if (!matches) return null;
  // find the confirmation link
  const link = matches.find(
    (url) => url.includes("token_hash=") || (url.includes("/verify?") && url.includes("token=")),
  );
  return link;
}

async function verifyPlatformDenial(status) {
  const client = standardClient(status);
  const testEmail = "platform.deny@example.test";
  const testPassword = "GraftVision-Platform-Deny-2026!";
  const admin = adminClient(status);

  await deleteUserByEmail(admin, testEmail);
  await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  const {
    data: { session },
    error,
  } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  ensure(!error && session, "Failed to authenticate for platform denial test.");

  // Test /platform denial
  try {
    const cookieHeader = `sb-graftvision-local-auth-token-code-verifier=; sb-graftvision-local-auth-token=${encodeURIComponent(JSON.stringify([session.access_token, session.refresh_token, null, null, null]))}`;
    const res = await fetch(`${webUrl}/platform`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader },
    });
    const responseBody = res.status === 200 ? await res.text() : "";
    const deniedPage =
      responseBody.includes("Platform access is not available") ||
      responseBody.includes("Access restricted") ||
      (responseBody.includes('__next-page-redirect"') && responseBody.includes("url=/login"));

    // /platform may redirect, reject, or render the explicit permission-denied state.
    ensure(
      res.status === 307 ||
        res.status === 302 ||
        res.status === 403 ||
        res.status === 401 ||
        deniedPage,
      "/platform did not deny access properly to ordinary user. Status: " + res.status,
    );
  } catch (e) {
    throw new LocalAuthLifecycleError(
      "Web application at http://localhost:3000 is not running or failed. " + e.message,
    );
  }
}

async function testInvitation(status) {
  const admin = adminClient(status);
  const client = standardClient(status);
  const testEmail = "lifecycle.invite@example.test";
  const newPassword = "GraftVision-New-Pass-2026!";

  // 1. Issue synthetic invitation
  await deleteUserByEmail(admin, testEmail);
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(testEmail, {
    data: { role: "proposal_only" },
  });
  ensure(!inviteError, "Failed to issue invitation.");

  // 2 & 3. Capture email and extract token safely without printing
  const link = await captureEmailLink(status.mailUrl, testEmail);
  ensure(link, "No valid token link found in email.");

  const url = new URL(link.replace(/&amp;/g, "&"));
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type");

  ensure(tokenHash && type === "invite", "Missing token_hash or type=invite in link.");

  // 4 & 5. Confirm token through production boundary
  const { data: confirmData, error: confirmError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  ensure(!confirmError && confirmData.session, "Failed to verify invite OTP or establish session.");

  // 7. Set new password
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  ensure(!updateError, "Failed to update password for invited user.");

  await client.auth.signOut();

  // 8. Log in with new password
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: newPassword,
  });
  ensure(!loginError && loginData.session, "Failed to log in with new password.");

  // 9. & 10. Replayed/Invalid token safely fails
  const { error: replayError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  ensure(replayError, "Replayed token must fail safely.");

  // 11. Expired token limitation: We use a deterministic invalid token here because true live expiry configuration is impractical to mutate dynamically.
  const { error: expiredError } = await client.auth.verifyOtp({
    token_hash: "invalid-hash-for-expiry",
    type: "invite",
  });
  ensure(expiredError, "Invalid/Expired token limitation must fail safely.");

  await client.auth.signOut();
  console.log("Invitation lifecycle passed.");
}

async function testRecovery(status) {
  const admin = adminClient(status);
  const client = standardClient(status);
  const knownEmail = "lifecycle.recover@example.test";
  const newPassword = "GraftVision-Recovered-2026!";
  const oldPassword = "GraftVision-Old-Pass-2026!";

  // Setup known user
  await deleteUserByEmail(admin, knownEmail);
  await admin.auth.admin.createUser({
    email: knownEmail,
    password: oldPassword,
    email_confirm: true,
  });

  // 12, 13, 14. Request recovery and prove identical response is handled by the route action. We test the provider responses here.
  const { error: recKnownError } = await client.auth.resetPasswordForEmail(knownEmail);
  const { error: recUnknownError } = await client.auth.resetPasswordForEmail(
    "unknown.recover@example.test",
  );
  ensure(!recKnownError && !recUnknownError, "Provider must not leak email existence via error.");

  // 15. Capture recovery email
  const link = await captureEmailLink(status.mailUrl, knownEmail);
  ensure(link, "No valid recovery link found in email.");

  const url = new URL(link.replace(/&amp;/g, "&"));
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type");

  ensure(tokenHash && type === "recovery", "Missing token_hash or type=recovery in link.");

  // 16. Confirm through production boundary
  const { data: confirmData, error: confirmError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  ensure(
    !confirmError && confirmData.session,
    "Failed to verify recovery OTP or establish session.",
  );

  // 18. Update password
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  ensure(!updateError, "Failed to update password for recovered user.");

  await client.auth.signOut();

  // 19. Old password fails
  const { error: oldLoginError } = await client.auth.signInWithPassword({
    email: knownEmail,
    password: oldPassword,
  });
  ensure(oldLoginError, "Old password must fail to authenticate.");

  // 20. New password succeeds
  const { data: newLoginData, error: newLoginError } = await client.auth.signInWithPassword({
    email: knownEmail,
    password: newPassword,
  });
  ensure(!newLoginError && newLoginData.session, "New password must authenticate successfully.");

  // 21. & 22. Replayed token denial
  const { error: replayError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  ensure(replayError, "Replayed recovery token must fail safely.");

  await client.auth.signOut();
  console.log("Recovery lifecycle passed.");
}

async function main() {
  const [mode, confirmation] = process.argv.slice(2);
  ensure(
    confirmation === confirmationFlag,
    "Use the explicit local Auth lifecycle confirmation flag.",
  );

  const status = await localStatus();

  // Check /platform denial HTTP level
  await verifyPlatformDenial(status);

  if (mode === "invitation") {
    await testInvitation(status);
  } else if (mode === "recovery") {
    await testRecovery(status);
  } else if (mode === "lifecycle") {
    await testInvitation(status);
    await testRecovery(status);
  } else {
    throw new LocalAuthLifecycleError("Invalid mode.");
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof LocalAuthLifecycleError) {
    console.error(`Local Auth lifecycle failed: ${error.message}`);
  } else {
    console.error(`Local Auth lifecycle failed safely. ${error}`);
  }
  process.exitCode = 1;
}
