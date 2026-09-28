import { describe, expect, it, vi } from "vitest";

import type { TenantTransaction } from "@graftvision/database";

import { AuthBoundaryError } from "../shared/errors";

import { evaluatePermission } from "./rbac";

describe("RBAC Permissions Evaluator", () => {
  const clinicContext = {
    applicationSessionId: "30000000-0000-4000-8000-000000000001",
    authorityScope: "clinic" as const,
    clinicId: "20000000-0000-4000-8000-000000000001",
    providerIdentityId: "10000000-0000-4000-8000-000000000001",
  };
  const platformContext = {
    applicationSessionId: "30000000-0000-4000-8000-000000000002",
    authorityScope: "platform" as const,
    providerIdentityId: "10000000-0000-4000-8000-000000000001",
  };

  it("returns true when database confirms permission", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ has_permission: true }],
    });
    const mockPool = {
      query,
    } as unknown as TenantTransaction;

    const result = await evaluatePermission(mockPool, clinicContext, "ROLE-001");

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.has_application_session_permission"),
      [
        clinicContext.applicationSessionId,
        clinicContext.providerIdentityId,
        "clinic",
        clinicContext.clinicId,
        "ROLE-001",
      ],
    );
  });

  it("returns false when database denies permission", async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ has_permission: false }],
      }),
    } as unknown as TenantTransaction;

    const result = await evaluatePermission(mockPool, clinicContext, "INVALID-PERM");

    expect(result).toBe(false);
  });

  it("returns false (deny by default) if no rows are returned", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
    });
    const mockPool = {
      query,
    } as unknown as TenantTransaction;

    const result = await evaluatePermission(mockPool, platformContext, "SOME-PERM");

    expect(result).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.has_application_session_permission"),
      [
        platformContext.applicationSessionId,
        platformContext.providerIdentityId,
        "platform",
        null,
        "SOME-PERM",
      ],
    );
  });

  it("throws AuthBoundaryError if database query fails", async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error("Connection lost")),
    } as unknown as TenantTransaction;

    await expect(evaluatePermission(mockPool, platformContext, "SOME-PERM")).rejects.toThrow(
      AuthBoundaryError,
    );
  });
});
