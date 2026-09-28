import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import * as authServer from "@graftvision/auth/server";

import { GET } from "./route";

vi.mock("@graftvision/auth/server", () => ({
  createRequestAuthClient: vi.fn(),
}));

describe("GET /auth/confirm", () => {
  it("rejects unsupported OTP types", async () => {
    const req = new NextRequest("http://localhost:3000/auth/confirm?token_hash=abc&type=signup");
    const res = await GET(req);
    expect(res.status).toBe(307); // NextResponse.redirect defaults to 307
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invalid_link");
  });

  it("rejects unknown OTP types", async () => {
    const req = new NextRequest("http://localhost:3000/auth/confirm?token_hash=abc&type=unknown");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invalid_link");
  });

  it("handles valid invite OTP and redirects to fixed destination", async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(authServer.createRequestAuthClient).mockResolvedValue({
      auth: { verifyOtp: verifyOtpMock },
    } as unknown as Awaited<ReturnType<typeof authServer.createRequestAuthClient>>);

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=test-hash&type=invite&next=https://evil.example.test",
    );
    const res = await GET(req);

    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "invite", token_hash: "test-hash" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/update-password");
  });

  it("handles valid recovery OTP and ignores encoded redirect bypasses", async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(authServer.createRequestAuthClient).mockResolvedValue({
      auth: { verifyOtp: verifyOtpMock },
    } as unknown as Awaited<ReturnType<typeof authServer.createRequestAuthClient>>);

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=rec-hash&type=recovery&next=%2F%2Fevil.example",
    );
    const res = await GET(req);

    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "recovery", token_hash: "rec-hash" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/update-password");
  });

  it("safely handles invalid token hash from provider", async () => {
    const verifyOtpMock = vi.fn().mockResolvedValue({ error: { message: "Token expired" } });
    vi.mocked(authServer.createRequestAuthClient).mockResolvedValue({
      auth: { verifyOtp: verifyOtpMock },
    } as unknown as Awaited<ReturnType<typeof authServer.createRequestAuthClient>>);

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=bad-hash&type=invite",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invalid_link");
  });
});
