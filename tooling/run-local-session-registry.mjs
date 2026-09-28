/* global fetch, FormData */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDatabase = createRequire(
  path.join(rootDirectory, "packages/database/package.json"),
);
const { Client } = requireFromDatabase("pg");
const confirmationFlag = "--confirm-local-session-registry";

class LocalSessionLifecycleError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalSessionLifecycleError";
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new LocalSessionLifecycleError(message);
  }
}

function decodeHtmlAttribute(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

async function submitLogin(webUrl, email, password) {
  const page = await fetch(`${webUrl}/login`);
  ensure(page.ok, "Login page is unavailable");
  const html = await page.text();
  const form = new FormData();
  const hiddenInputPattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/gu;

  for (const match of html.matchAll(hiddenInputPattern)) {
    const name = match[1];
    if (name) {
      form.append(name, decodeHtmlAttribute(match[2] ?? ""));
    }
  }

  form.append("email", email);
  form.append("password", password);
  form.append("next", "/clinic");

  return fetch(`${webUrl}/login`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
}

async function submitLockedForm(webUrl, cookie, password) {
  const page = await fetch(`${webUrl}/locked`, { headers: { Cookie: cookie } });
  ensure(page.ok, "Locked page is unavailable");
  const html = await page.text();
  ensure(
    !/Clinic application shell|Authenticated user|patient-sensitive/iu.test(html),
    "Locked page leaked protected context",
  );
  const unlockFormHtml = html.match(/<form[^>]*>[\s\S]*?name="password"[\s\S]*?<\/form>/u)?.[0];
  ensure(unlockFormHtml, "Password unlock form is missing");
  const form = new FormData();
  const hiddenInputPattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/gu;

  for (const match of unlockFormHtml.matchAll(hiddenInputPattern)) {
    const name = match[1];
    if (name) {
      form.append(name, decodeHtmlAttribute(match[2] ?? ""));
    }
  }
  form.append("password", password);

  return fetch(`${webUrl}/locked`, {
    method: "POST",
    body: form,
    headers: { Cookie: cookie },
    redirect: "manual",
  });
}

async function isDeniedResponse(response) {
  if (
    response.status === 302 ||
    response.status === 303 ||
    response.status === 307 ||
    response.status === 401 ||
    response.status === 403 ||
    response.headers.get("location")?.includes("/login")
  ) {
    return true;
  }

  if (response.status !== 200) {
    return false;
  }

  const body = await response.text();
  return body.includes('__next-page-redirect"') && body.includes("url=/login");
}

async function main() {
  console.log("Running live session registry checks...");

  ensure(process.argv.slice(2).length === 1, "Use only the local session confirmation flag");
  ensure(process.argv.includes(confirmationFlag), `Missing ${confirmationFlag} flag`);

  const appEnv = process.env.APP_ENV || "local";
  ensure(appEnv === "local" || appEnv === "test", "APP_ENV must be local or test");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  ensure(
    supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost"),
    "Remote Supabase project references are not permitted",
  );

  const dbUrl =
    process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  ensure(
    dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost"),
    "Database host must be loopback",
  );

  const webUrl = "http://localhost:3000";

  // Check if web app is running
  try {
    const res = await fetch(`${webUrl}/login`);
    ensure(res.ok, "Web application is not running or returning errors");
  } catch {
    throw new LocalSessionLifecycleError("Web application is not running at " + webUrl);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const email = "owner.alpha@example.test";
    const password = "GraftVision-Synthetic-Test-Only-2026!";

    const extractRequestCookies = (headers) => {
      const setCookies =
        typeof headers.getSetCookie === "function"
          ? headers.getSetCookie()
          : [headers.get("set-cookie") ?? ""];
      const requestCookies = setCookies
        .map((cookie) => cookie.split(";")[0])
        .filter(Boolean)
        .join("; ");
      ensure(requestCookies.includes("gv_session=v1."), "Application session cookie is missing");
      return requestCookies;
    };

    const applicationSessionId = (requestCookies) => {
      const match = requestCookies.match(/(?:^|; )gv_session=v1\.([^. ;]+)/u);
      ensure(match?.[1], "Application session ID is missing");
      return match[1];
    };

    // 1. Sign in with Client A.
    const loginA = await submitLogin(webUrl, email, password);
    const setCookieA = loginA.headers.get("set-cookie") || "";
    ensure(setCookieA.includes("gv_session=v1."), "Expected v1. session cookie from login A");
    ensure(
      loginA.status === 303 && loginA.headers.get("location").endsWith("/clinic"),
      "Login A should redirect to /clinic",
    );

    // Extract cookie for A
    const cookieA = extractRequestCookies(loginA.headers);

    // 2. Confirm real application_session row and signed cookie
    const authReqA = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieA },
      redirect: "manual",
    });
    ensure(authReqA.status !== 303, "Client A should have access to protected route");

    // 3. Sign in with Client B
    const loginB = await submitLogin(webUrl, email, password);
    const setCookieB = loginB.headers.get("set-cookie") || "";
    ensure(setCookieB.includes("gv_session=v1."), "Expected v1. session cookie from login B");
    const cookieB = extractRequestCookies(loginB.headers);

    // Check we have two different session cookies
    ensure(cookieA !== cookieB, "Client A and B should have distinct session cookies");

    // 5. Revoke Client A from Client B
    // Parse session ID from cookie A
    const sessionIdA = applicationSessionId(cookieA);

    const revokeA = await fetch(`${webUrl}/api/session/revoke`, {
      method: "POST",
      headers: { Cookie: cookieB, "Content-Type": "application/json", Origin: webUrl },
      body: JSON.stringify({ sessionId: sessionIdA }),
    });
    ensure(revokeA.ok, "Revoke A API failed");

    // 6. Confirm Client A is denied on next protected request
    const checkA = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieA },
      redirect: "manual",
    });
    ensure(await isDeniedResponse(checkA), "Client A should be denied after revocation");

    // 7. Confirm Client B remains active
    const checkB = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieB },
      redirect: "manual",
    });
    ensure(!(await isDeniedResponse(checkB)), "Client B should remain active");

    // 8. Revoke all other sessions
    // First create a Client C
    const loginC = await submitLogin(webUrl, email, password);
    const cookieC = extractRequestCookies(loginC.headers);

    const revokeAll = await fetch(`${webUrl}/api/session/revoke-all`, {
      method: "POST",
      headers: { Cookie: cookieC, Origin: webUrl },
    });
    ensure(revokeAll.ok, "Revoke all API failed");

    // 9. Confirm only current session remains
    const checkBAfter = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieB },
      redirect: "manual",
    });
    ensure(await isDeniedResponse(checkBAfter), "Client B should be denied after revoke all");
    const checkC = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieC },
      redirect: "manual",
    });
    ensure(!(await isDeniedResponse(checkC)), "Client C should remain active");

    // Test approved successful user activity through the dedicated protected endpoint.
    const renewReq = await fetch(`${webUrl}/api/session/activity`, {
      method: "POST",
      headers: { Cookie: cookieC, Origin: webUrl },
    });
    ensure(renewReq.ok, "Activity renewal API failed");

    // 12. Test idle expiry using controlled test policy values
    const sessionIdC = applicationSessionId(cookieC);
    await client.query(
      `update public.application_session set last_activity_at = timezone('utc', statement_timestamp()) - interval '1 hour' where id = $1`,
      [sessionIdC],
    );

    const checkCIdle = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieC },
      redirect: "manual",
    });
    ensure(
      checkCIdle.status === 307 && checkCIdle.headers.get("location")?.endsWith("/locked"),
      "Client C should be redirected to the privacy-safe lock boundary after idle timeout",
    );

    const sessionAfterIdle = await client.query(
      `select locked_at, lock_reason_code, revoked_at
       from public.application_session where id = $1`,
      [sessionIdC],
    );
    ensure(sessionAfterIdle.rows[0]?.locked_at, "Idle timeout did not persist locked_at");
    ensure(sessionAfterIdle.rows[0]?.lock_reason_code === "IDLE", "Idle lock reason is invalid");
    ensure(sessionAfterIdle.rows[0]?.revoked_at === null, "Idle lock must not revoke the session");

    const unlockC = await submitLockedForm(webUrl, cookieC, password);
    const unlockRedirect =
      unlockC.headers.get("location") ?? unlockC.headers.get("x-action-redirect") ?? "";
    ensure(
      unlockC.status === 303 && unlockRedirect.includes("/clinic"),
      `Password reauthentication did not unlock the original clinic scope (${unlockC.status}, ${unlockRedirect || "no redirect"})`,
    );

    const checkCAfterUnlock = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieC },
      redirect: "manual",
    });
    ensure(!(await isDeniedResponse(checkCAfterUnlock)), "Unlocked Client C should regain access");

    // Failed password reauthentication must audit and revoke through logout fallback.
    const failedLogin = await submitLogin(webUrl, email, password);
    const failedCookie = extractRequestCookies(failedLogin.headers);
    const failedSessionId = applicationSessionId(failedCookie);
    const manualLock = await fetch(`${webUrl}/api/session/lock`, {
      body: JSON.stringify({ reason: "manual" }),
      headers: { Cookie: failedCookie, "Content-Type": "application/json", Origin: webUrl },
      method: "POST",
    });
    ensure(manualLock.ok, "Manual shared-device lock failed");

    const failedUnlock = await submitLockedForm(webUrl, failedCookie, "wrong-password");
    const failedRedirect =
      failedUnlock.headers.get("location") ?? failedUnlock.headers.get("x-action-redirect") ?? "";
    ensure(
      failedUnlock.status === 303 && failedRedirect.includes("/login"),
      "Failed reauthentication did not fall back to logout",
    );

    const failedState = await client.query(
      `select revoked_at from public.application_session where id = $1`,
      [failedSessionId],
    );
    ensure(failedState.rows[0]?.revoked_at, "Failed reauthentication did not revoke the session");
    const failedAudit = await client.query(
      `select action from public.audit_event
       where resource_id = $1
         and action in ('session.reauthentication_failed', 'session.logout_after_lock')`,
      [failedSessionId],
    );
    ensure(failedAudit.rowCount === 2, "Failed reauthentication audit actions are incomplete");

    // 13. Test absolute expiry
    const loginD = await submitLogin(webUrl, email, password);
    const cookieD = extractRequestCookies(loginD.headers);
    const sessionIdD = applicationSessionId(cookieD);

    await client.query(
      `update public.application_session set absolute_expires_at = timezone('utc', statement_timestamp()) - interval '1 minute' where id = $1`,
      [sessionIdD],
    );

    const checkDAbsolute = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieD },
      redirect: "manual",
    });
    ensure(
      await isDeniedResponse(checkDAbsolute),
      "Client D should be denied after simulated absolute expiry",
    );

    // 10. Deactivate the platform user and confirm immediate application denial.
    // 11. Reactivate only within local test cleanup.
    const loginE = await submitLogin(webUrl, email, password);
    const cookieE = extractRequestCookies(loginE.headers);

    const platformUserIdRes = await client.query(
      `select platform_user_id from public.application_session where id = $1`,
      [applicationSessionId(cookieE)],
    );
    const platformUserId = platformUserIdRes.rows[0].platform_user_id;

    await client.query(`update public.platform_user set status = 'suspended' where id = $1`, [
      platformUserId,
    ]);

    const checkE = await fetch(`${webUrl}/clinic`, {
      headers: { Cookie: cookieE },
      redirect: "manual",
    });
    ensure(await isDeniedResponse(checkE), "Client E should be denied after deactivation");

    await client.query(`update public.platform_user set status = 'active' where id = $1`, [
      platformUserId,
    ]);
  } finally {
    await client.end();
  }

  console.log("Integration tested passed (Live via loopback).");
}

try {
  await main();
} catch (error) {
  if (error instanceof LocalSessionLifecycleError) {
    console.error(`Local Session lifecycle failed: ${error.message}`);
  } else {
    console.error(`Local Session lifecycle failed safely. ${error}`);
  }
  process.exitCode = 1;
}
