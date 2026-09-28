import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as recordActivity } from "./api/session/activity/route";
import { POST as lockSession } from "./api/session/lock/route";
import { POST as revokeSession } from "./api/session/revoke/route";
import { POST as revokeAllSessions } from "./api/session/revoke-all/route";

const auth = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  lockCurrentApplicationSession: vi.fn(),
  recordSuccessfulApplicationActivity: vi.fn(),
  terminateAllOtherSessions: vi.fn(),
  terminateOtherSession: vi.fn(),
}));

vi.mock("@graftvision/auth/server", () => auth);

const origin = "https://graftvision.example.test";
const providerIdentityId = "e1000000-0000-4000-8000-000000000001";
const otherSessionId = "50000000-0000-4000-8000-000000000002";

function request(
  pathname: string,
  body?: unknown,
  requestOrigin: string | null = origin,
): NextRequest {
  const headers = new Headers();
  if (requestOrigin !== null) {
    headers.set("origin", requestOrigin);
  }
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(`${origin}${pathname}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
    method: "POST",
  });
}

function providerClient(userId: string | null = providerIdentityId, hasError = false) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId === null ? null : { id: userId } },
        error: hasError ? new Error("provider unavailable") : null,
      }),
    },
  };
}

async function routeFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await routeFiles(path.join(directory, entry.name), relative)));
    } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
      files.push(relative);
    }
  }
  return files.sort();
}

describe("current protected-route inventory", () => {
  it("matches the executable Web route surface and proxy matcher exactly", async () => {
    const appDirectory = path.join(process.cwd(), "src/app");
    await expect(routeFiles(appDirectory)).resolves.toEqual([
      "(clinic)/clinic/onboarding/page.tsx",
      "(clinic)/clinic/page.tsx",
      "(clinic)/clinic/patients/[patientId]/consultations/[consultationId]/page.tsx",
      "(clinic)/clinic/patients/[patientId]/consultations/new/page.tsx",
      "(clinic)/clinic/patients/[patientId]/page.tsx",
      "(clinic)/clinic/patients/[patientId]/privacy/page.tsx",
      "(clinic)/clinic/patients/page.tsx",
      "(clinic)/clinic/patients/register/page.tsx",
      "(clinic)/clinic/settings/branding/page.tsx",
      "(clinic)/clinic/settings/page.tsx",
      "(clinic)/clinic/staff/page.tsx",
      "(platform)/platform/page.tsx",
      "(public)/locked/page.tsx",
      "(public)/login/page.tsx",
      "(public)/page.tsx",
      "(public)/recovery/page.tsx",
      "(public)/update-password/page.tsx",
      "api/model-packages/[modelPackageId]/artifact/route.ts",
      "api/scan-sessions/[scanSessionId]/capture/route.ts",
      "api/scan-sessions/[scanSessionId]/media/[assetId]/route.ts",
      "api/scan-sessions/[scanSessionId]/media/route.ts",
      "api/scan-sessions/[scanSessionId]/status/route.ts",
      "api/scan/pair/route.ts",
      "api/session/activity/route.ts",
      "api/session/lock/route.ts",
      "api/session/revoke-all/route.ts",
      "api/session/revoke/route.ts",
      "auth/confirm/route.ts",
    ]);

    const proxy = await readFile(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxy).toContain('matcher: ["/login", "/locked", "/clinic/:path*", "/platform/:path*"]');
  });
});

describe("session Route Handler protection matrix", () => {
  beforeEach(() => {
    auth.createRequestAuthClient.mockResolvedValue(providerClient());
    auth.lockCurrentApplicationSession.mockResolvedValue(true);
    auth.recordSuccessfulApplicationActivity.mockResolvedValue(true);
    auth.terminateAllOtherSessions.mockResolvedValue(undefined);
    auth.terminateOtherSession.mockResolvedValue(undefined);
  });

  it.each([
    ["activity", recordActivity, "/api/session/activity"],
    ["lock", lockSession, "/api/session/lock"],
    ["revoke one", revokeSession, "/api/session/revoke"],
    ["revoke all", revokeAllSessions, "/api/session/revoke-all"],
  ] as const)(
    "denies cross-origin and missing-origin direct calls to %s",
    async (_name, route, url) => {
      for (const untrustedOrigin of ["https://attacker.example.test", null]) {
        const response = await route(
          request(
            url,
            url.endsWith("/lock")
              ? { reason: "manual" }
              : url.endsWith("/revoke")
                ? { sessionId: otherSessionId }
                : undefined,
            untrustedOrigin,
          ),
        );
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: "REQUEST_DENIED" });
      }
    },
  );

  it.each([
    ["activity", recordActivity, "/api/session/activity"],
    ["lock", lockSession, "/api/session/lock"],
    ["revoke one", revokeSession, "/api/session/revoke"],
    ["revoke all", revokeAllSessions, "/api/session/revoke-all"],
  ] as const)(
    "denies unauthenticated provider access to %s without protected data",
    async (_name, route, url) => {
      auth.createRequestAuthClient.mockResolvedValue(providerClient(null));
      const response = await route(
        request(
          url,
          url.endsWith("/lock")
            ? { reason: "manual" }
            : url.endsWith("/revoke")
              ? { sessionId: otherSessionId }
              : undefined,
        ),
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "AUTH_SESSION_REQUIRED" });
    },
  );

  it("allows only a matching provider boundary to revoke session records", async () => {
    const one = await revokeSession(request("/api/session/revoke", { sessionId: otherSessionId }));
    const all = await revokeAllSessions(request("/api/session/revoke-all"));

    expect(one.status).toBe(200);
    expect(all.status).toBe(200);
    expect(auth.terminateOtherSession).toHaveBeenCalledWith(otherSessionId, providerIdentityId);
    expect(auth.terminateAllOtherSessions).toHaveBeenCalledWith(providerIdentityId);
  });

  it("does not expose submitted values in malformed or denied responses", async () => {
    const sensitive = "SyntheticPassword! Token Cookie OTP Patient";
    const malformed = await revokeSession(request("/api/session/revoke", { sessionId: sensitive }));
    const denied = await lockSession(
      request("/api/session/lock", { reason: sensitive }, "https://attacker.example.test"),
    );

    expect(await malformed.text()).not.toContain(sensitive);
    expect(await denied.text()).not.toContain(sensitive);
    expect(auth.terminateOtherSession).not.toHaveBeenCalled();
  });
});
