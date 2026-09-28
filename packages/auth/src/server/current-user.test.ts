import { describe, expect, it, vi } from "vitest";

import { AuthBoundaryError } from "../shared/errors";

import { resolveCurrentUser, resolveLoginUser, selectLoginAuthority } from "./current-user";

import type { SupabaseClient, User } from "@supabase/supabase-js";

function authClient(user: Partial<User> | null, error: Error | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  } as unknown as Pick<SupabaseClient, "auth">;
}

describe("resolveCurrentUser", () => {
  it("returns only the safe internal identity contract", async () => {
    const resolver = vi.fn().mockResolvedValue({
      access: "active",
      clinicId: "20000000-0000-4000-8000-000000000001",
      platformUserId: "10000000-0000-4000-8000-000000000001",
    });

    await expect(
      resolveCurrentUser(
        authClient({
          email: "owner.alpha@example.test",
          id: "10000000-0000-4000-8000-000000000001",
        }),
        resolver,
      ),
    ).resolves.toEqual({
      clinicId: "20000000-0000-4000-8000-000000000001",
      displayLabel: "Authenticated user",
      platformUserId: "10000000-0000-4000-8000-000000000001",
      status: "active",
    });
    expect(resolver).toHaveBeenCalledWith({
      email: "owner.alpha@example.test",
      id: "10000000-0000-4000-8000-000000000001",
    });
  });

  it("rejects missing and invalid sessions generically", async () => {
    const resolver = vi.fn();

    for (const client of [authClient(null), authClient(null, new Error("expired token"))]) {
      await expect(resolveCurrentUser(client, resolver)).rejects.toMatchObject({
        code: "AUTH_SESSION_REQUIRED",
      });
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it("never resolves identity by email when the provider UUID is absent", async () => {
    const resolver = vi.fn();
    await expect(
      resolveCurrentUser(authClient({ email: "owner.alpha@example.test", id: "" }), resolver),
    ).rejects.toBeInstanceOf(AuthBoundaryError);
  });

  it.each([
    ["identity-not-linked", "AUTH_IDENTITY_NOT_LINKED"],
    ["internal-user-inactive", "AUTH_INTERNAL_USER_INACTIVE"],
    ["clinic-access-unavailable", "AUTH_CLINIC_ACCESS_UNAVAILABLE"],
  ] as const)("maps %s to a safe internal error", async (access, code) => {
    await expect(
      resolveCurrentUser(
        authClient({
          email: "synthetic@example.test",
          id: "10000000-0000-4000-8000-000000000001",
        }),
        vi.fn().mockResolvedValue({ access }),
      ),
    ).rejects.toMatchObject({ code });
  });
});

describe("platform login scope resolution", () => {
  it("selects platform scope for a bootstrap-only Platform Owner", async () => {
    const identity = await resolveLoginUser(
      authClient({
        email: "owner@example.test",
        id: "10000000-0000-4000-8000-000000000001",
      }),
      vi.fn().mockResolvedValue({
        access: "active",
        clinicId: null,
        hasPlatformOwnerAuthority: true,
        platformUserId: "10000000-0000-4000-8000-000000000001",
      }),
    );

    expect(selectLoginAuthority(identity)).toEqual({
      authorityScope: "platform",
      destination: "/platform",
    });
  });

  it("preserves clinic scope for clinic-only users", async () => {
    const identity = await resolveLoginUser(
      authClient({
        email: "clinic@example.test",
        id: "10000000-0000-4000-8000-000000000002",
      }),
      vi.fn().mockResolvedValue({
        access: "active",
        clinicId: "20000000-0000-4000-8000-000000000001",
        hasPlatformOwnerAuthority: false,
        platformUserId: "10000000-0000-4000-8000-000000000002",
      }),
    );

    expect(selectLoginAuthority(identity)).toEqual({
      authorityScope: "clinic",
      clinicId: "20000000-0000-4000-8000-000000000001",
      destination: "/clinic",
    });
  });

  it("defaults dual-scope Platform Owners to platform without selecting a clinic", () => {
    expect(
      selectLoginAuthority({
        clinicId: "20000000-0000-4000-8000-000000000001",
        displayLabel: "Authenticated user",
        hasPlatformOwnerAuthority: true,
        platformUserId: "10000000-0000-4000-8000-000000000001",
        status: "active",
      }),
    ).toEqual({ authorityScope: "platform", destination: "/platform" });
  });

  it.each([
    ["application-scope-unavailable", "AUTH_APPLICATION_SCOPE_UNAVAILABLE"],
    ["internal-user-inactive", "AUTH_INTERNAL_USER_INACTIVE"],
  ] as const)("maps %s to a safe login error", async (access, code) => {
    await expect(
      resolveLoginUser(
        authClient({
          email: "denied@example.test",
          id: "10000000-0000-4000-8000-000000000003",
        }),
        vi.fn().mockResolvedValue({ access }),
      ),
    ).rejects.toMatchObject({ code });
  });
});
