import { describe, expect, it, vi } from "vitest";

import { resolveAuthIdentity, resolveLoginIdentity } from "./auth-identity";

import type { Pool } from "pg";

function poolReturning(rows: readonly Record<string, unknown>[], rowCount = rows.length): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rowCount, rows }),
  } as unknown as Pool;
}

describe("resolveAuthIdentity", () => {
  it("requires the trusted Auth UUID and verified external identity together", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          active_membership_count: 1,
          default_clinic_id: "20000000-0000-4000-8000-000000000001",
          id: "10000000-0000-4000-8000-000000000001",
          status: "active",
        },
      ],
    });
    const pool = { query } as unknown as Pool;

    await expect(
      resolveAuthIdentity(pool, "10000000-0000-4000-8000-000000000001", "owner.alpha@example.test"),
    ).resolves.toEqual({
      access: "active",
      clinicId: "20000000-0000-4000-8000-000000000001",
      platformUserId: "10000000-0000-4000-8000-000000000001",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("platform_user.id = $1::uuid"), [
      "10000000-0000-4000-8000-000000000001",
      "owner.alpha@example.test",
    ]);
  });

  it("rejects missing or duplicate linkage safely", async () => {
    await expect(
      resolveAuthIdentity(poolReturning([]), "synthetic-id", "a@example.test"),
    ).resolves.toEqual({ access: "identity-not-linked" });
    await expect(
      resolveAuthIdentity(
        poolReturning(
          [
            {
              active_membership_count: 1,
              default_clinic_id: "clinic-one",
              id: "one",
              status: "active",
            },
            {
              active_membership_count: 1,
              default_clinic_id: "clinic-two",
              id: "two",
              status: "active",
            },
          ],
          2,
        ),
        "synthetic-id",
        "a@example.test",
      ),
    ).resolves.toEqual({ access: "identity-not-linked" });
  });

  it("rejects inactive internal users", async () => {
    await expect(
      resolveAuthIdentity(
        poolReturning([
          {
            active_membership_count: 1,
            default_clinic_id: "clinic-one",
            id: "one",
            status: "suspended",
          },
        ]),
        "synthetic-id",
        "a@example.test",
      ),
    ).resolves.toEqual({ access: "internal-user-inactive" });
  });

  it("rejects users without an active clinic membership", async () => {
    await expect(
      resolveAuthIdentity(
        poolReturning([
          { active_membership_count: 0, default_clinic_id: null, id: "one", status: "active" },
        ]),
        "synthetic-id",
        "a@example.test",
      ),
    ).resolves.toEqual({ access: "clinic-access-unavailable" });
  });

  it("redacts database failures as missing linkage", async () => {
    const pool = {
      query: vi.fn().mockRejectedValue(new Error("synthetic database detail")),
    } as unknown as Pool;

    await expect(resolveAuthIdentity(pool, "synthetic-id", "a@example.test")).resolves.toEqual({
      access: "identity-not-linked",
    });
  });
});

describe("resolveLoginIdentity", () => {
  it("resolves a bootstrap-only Platform Owner without requiring clinic membership", async () => {
    await expect(
      resolveLoginIdentity(
        poolReturning([
          {
            active_membership_count: 0,
            default_clinic_id: null,
            has_platform_owner_authority: true,
            id: "10000000-0000-4000-8000-000000000001",
            status: "active",
          },
        ]),
        "10000000-0000-4000-8000-000000000001",
        "owner@example.test",
      ),
    ).resolves.toEqual({
      access: "active",
      clinicId: null,
      hasPlatformOwnerAuthority: true,
      platformUserId: "10000000-0000-4000-8000-000000000001",
    });
  });

  it("preserves clinic-only login and requires an active clinic role", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          active_membership_count: 1,
          default_clinic_id: "20000000-0000-4000-8000-000000000001",
          has_platform_owner_authority: false,
          id: "10000000-0000-4000-8000-000000000002",
          status: "active",
        },
      ],
    });

    await expect(
      resolveLoginIdentity(
        { query } as unknown as Pool,
        "10000000-0000-4000-8000-000000000002",
        "clinic@example.test",
      ),
    ).resolves.toMatchObject({
      access: "active",
      clinicId: "20000000-0000-4000-8000-000000000001",
      hasPlatformOwnerAuthority: false,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("role.role_type = 'clinic'"), [
      "10000000-0000-4000-8000-000000000002",
      "clinic@example.test",
    ]);
  });

  it("denies Support and users with no active application scope", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            active_membership_count: 0,
            default_clinic_id: null,
            has_platform_owner_authority: false,
            id: "10000000-0000-4000-8000-000000000003",
            status: "active",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ audit_event_id: "synthetic" }] });
    await expect(
      resolveLoginIdentity(
        { query } as unknown as Pool,
        "10000000-0000-4000-8000-000000000003",
        "support@example.test",
      ),
    ).resolves.toEqual({ access: "application-scope-unavailable" });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("'session.create'"), [
      "10000000-0000-4000-8000-000000000003",
      "LOGIN_SCOPE_UNAVAILABLE",
    ]);
  });

  it("denies inactive platform identities", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            active_membership_count: 0,
            default_clinic_id: null,
            has_platform_owner_authority: true,
            id: "10000000-0000-4000-8000-000000000004",
            status: "inactive",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ audit_event_id: "synthetic" }] });
    await expect(
      resolveLoginIdentity(
        { query } as unknown as Pool,
        "10000000-0000-4000-8000-000000000004",
        "inactive@example.test",
      ),
    ).resolves.toEqual({ access: "internal-user-inactive" });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("'session.create'"), [
      "10000000-0000-4000-8000-000000000004",
      "LOGIN_INACTIVE_USER",
    ]);
  });
});
