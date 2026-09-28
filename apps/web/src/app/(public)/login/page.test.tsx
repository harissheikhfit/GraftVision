import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  getActiveApplicationSession: vi.fn(),
  hasVerifiedAuthSession: vi.fn(),
}));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("next/navigation", () => navigation);

import LoginPage from "./page";

describe("login page session handling", () => {
  beforeEach(() => {
    auth.createRequestAuthClient.mockResolvedValue({});
    auth.hasVerifiedAuthSession.mockResolvedValue(false);
    auth.getActiveApplicationSession.mockResolvedValue(null);
  });

  it.each(["missing", "malformed", "stale", "revoked", "expired", "locked"])(
    "renders when the application session cookie is %s",
    async () => {
      render(await LoginPage());

      expect(screen.getByRole("heading", { name: "Sign in to GraftVision" })).toBeInTheDocument();
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["platform", "/platform"],
    ["clinic", "/clinic"],
  ] as const)("redirects a valid %s session", async (authorityScope, destination) => {
    auth.hasVerifiedAuthSession.mockResolvedValue(true);
    auth.getActiveApplicationSession.mockResolvedValue({ authorityScope });

    await LoginPage();

    expect(navigation.redirect).toHaveBeenCalledWith(destination);
  });
});
