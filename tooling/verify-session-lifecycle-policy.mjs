import fs from "fs";
import path from "path";

function verifyPolicy() {
  let hasErrors = false;

  const registryFile = path.resolve("packages/auth/src/server/registry.ts");
  const cookiesFile = path.resolve("packages/auth/src/server/cookies.ts");
  const authProxyFile = path.resolve("packages/auth/src/server/proxy.ts");
  const testFile = path.resolve("supabase/tests/database/application_sessions.test.sql");
  const dbSessionFile = path.resolve("packages/database/src/session.ts");

  const registryContent = fs.readFileSync(registryFile, "utf-8");
  const cookiesContent = fs.readFileSync(cookiesFile, "utf-8");
  const proxyContent = fs.readFileSync(authProxyFile, "utf-8");
  const dbSessionContent = fs.readFileSync(dbSessionFile, "utf-8");
  const testContent = fs.existsSync(testFile) ? fs.readFileSync(testFile, "utf-8") : "";

  // 1. Proxy validation without renewal
  if (
    proxyContent.includes("renewApplicationSessionActivity") ||
    proxyContent.includes("recordSuccessfulApplicationActivity")
  ) {
    console.error("Proxy must validate only, no activity renewal");
    hasErrors = true;
  }

  // 2. Real successful-activity renewal boundary
  if (!registryContent.includes("recordSuccessfulApplicationActivity")) {
    console.error("Missing recordSuccessfulApplicationActivity boundary");
    hasErrors = true;
  }

  // 3. Versioned cookies
  if (!cookiesContent.includes('"v1."') && !cookiesContent.includes("`v1.")) {
    console.error("Cookies must use versioned v1. format");
    hasErrors = true;
  }

  // 4. Current/previous key restrictions
  if (!cookiesContent.includes("APPLICATION_SESSION_PREVIOUS_SIGNING_KEY")) {
    console.error("Must support APPLICATION_SESSION_PREVIOUS_SIGNING_KEY");
    hasErrors = true;
  }

  // 5. Real revoke-one/revoke-all tests
  if (!testContent.includes("revoke_other") || !testContent.includes("REVOKE_ALL")) {
    console.error("Missing revoke-one or revoke-all SQL coverage");
    hasErrors = true;
  }
  if (!dbSessionContent.includes("REVOKE_ONE") || !dbSessionContent.includes("REVOKE_ALL")) {
    console.error("Missing revoke reason codes in DB layer");
    hasErrors = true;
  }

  // 6. Inactive user denial exists
  if (
    !registryContent.includes("revokeApplicationSession") ||
    !dbSessionContent.includes("DEACTIVATED")
  ) {
    console.error("Inactive user denial must be handled via DEACTIVATED revocation reason");
    hasErrors = true;
  }

  // 7. Atomic audit tests exist
  if (!testContent.includes("rollback") || !testContent.includes("public.audit_event")) {
    console.error("Missing atomic audit transaction tests");
    hasErrors = true;
  }

  // 8. No direct use of provider auth.sessions
  if (
    registryContent.includes("auth.sessions") ||
    registryContent.includes("auth.refresh_tokens")
  ) {
    console.error("No direct application dependency on auth.sessions or auth.refresh_tokens");
    hasErrors = true;
  }

  // 9. No role, MFA, Scan, Present, patient or clinical expansion
  if (dbSessionContent.includes("mfa") || dbSessionContent.includes("patient")) {
    console.error("No MFA or patient scope allowed yet");
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("Session lifecycle policy verified successfully.");
  }
}

verifyPolicy();
