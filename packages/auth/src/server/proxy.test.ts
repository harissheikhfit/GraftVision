import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshAuthSession } from "./proxy";

const fixtures = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAuthEnvironment: vi.fn(),
  getCurrentApplicationSessionState: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: fixtures.createServerClient }));
vi.mock("@graftvision/config/env/auth", () => ({
  getAuthEnvironment: fixtures.getAuthEnvironment,
}));
vi.mock("./registry", () => ({
  getCurrentApplicationSessionState: fixtures.getCurrentApplicationSessionState,
}));

const providerIdentityId = "10000000-0000-4000-8000-000000000001";
const otherProviderIdentityId = "10000000-0000-4000-8000-000000000002";
const clinicId = "20000000-0000-4000-8000-000000000001";

function applicationSession(
  authorityScope: "clinic" | "platform",
  platformUserId = providerIdentityId,
) {
  return {
    authorityScope,
    clinicId: authorityScope === "clinic" ? clinicId : null,
    platformUserId,
  };
}

describe("protected shell proxy matrix", () => {
  const getUser = vi.fn();
  const signOut = vi.fn();

  beforeEach(() => {
    fixtures.getAuthEnvironment.mockReturnValue({
      APP_ENV: "test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
    getUser.mockResolvedValue({ data: { user: { id: providerIdentityId } }, error: null });
    signOut.mockResolvedValue({ error: null });
    fixtures.createServerClient.mockReturnValue({ auth: { getUser, signOut } });
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: applicationSession("clinic"),
      status: "active",
    });
  });

  it.each([
    ["/clinic", "clinic"],
    ["/clinic/reserved", "clinic"],
    ["/platform", "platform"],
    ["/platform/reserved", "platform"],
  ] as const)("allows %s only with matching %s scope", async (pathname, scope) => {
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: applicationSession(scope),
      status: "active",
    });

    const response = await refreshAuthSession(
      new NextRequest(`https://graftvision.example.test${pathname}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["/clinic", "platform"],
    ["/platform", "clinic"],
  ] as const)("denies wrong-scope access to %s", async (pathname, scope) => {
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: applicationSession(scope),
      status: "active",
    });

    const response = await refreshAuthSession(
      new NextRequest(`https://graftvision.example.test${pathname}?patient=synthetic`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://graftvision.example.test/login");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await response.text()).not.toContain("synthetic");
  });

  it("denies a forged provider/application-session identity pairing", async () => {
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({
      session: applicationSession("clinic", otherProviderIdentityId),
      status: "active",
    });

    const response = await refreshAuthSession(
      new NextRequest("https://graftvision.example.test/clinic"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://graftvision.example.test/login");
  });

  it("clears an invalid application cookie only from the proxy response boundary", async () => {
    fixtures.getCurrentApplicationSessionState.mockResolvedValue({ status: "invalid" });

    const response = await refreshAuthSession(
      new NextRequest("https://graftvision.example.test/platform"),
    );

    expect(response.headers.get("location")).toBe("https://graftvision.example.test/login");
    expect(response.cookies.get("gv_session")?.value).toBe("");
  });

  it("routes every locked clinic or platform session to the privacy boundary", async () => {
    for (const scope of ["clinic", "platform"] as const) {
      fixtures.getCurrentApplicationSessionState.mockResolvedValue({
        session: applicationSession(scope),
        status: "locked",
      });
      const response = await refreshAuthSession(
        new NextRequest(`https://graftvision.example.test/${scope}?patient=synthetic`),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://graftvision.example.test/locked");
      expect(await response.text()).not.toContain("synthetic");
    }
  });

  it("redirects an active locked-page request only to its existing authority shell", async () => {
    for (const scope of ["clinic", "platform"] as const) {
      fixtures.getCurrentApplicationSessionState.mockResolvedValue({
        session: applicationSession(scope),
        status: "active",
      });
      const response = await refreshAuthSession(
        new NextRequest("https://graftvision.example.test/locked?patient=synthetic"),
      );
      expect(response.headers.get("location")).toBe(`https://graftvision.example.test/${scope}`);
    }
  });

  it("leaves unauthenticated protected requests to the server component deny boundary", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await refreshAuthSession(
      new NextRequest("https://graftvision.example.test/clinic"),
    );
    expect(response.status).toBe(200);
    expect(fixtures.getCurrentApplicationSessionState).not.toHaveBeenCalled();
  });
});
