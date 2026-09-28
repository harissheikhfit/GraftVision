import { describe, expect, it, vi } from "vitest";

import { writeAuditEvent } from "../audit";

import {
  TenantBoundaryError,
  assertActiveTenantContext,
  assertTenantContext,
  establishTenantContext,
  getTrustedTenantContext,
  reuseTenantTransaction,
  validateTenantIdentifier,
} from "./index";

import type { TenantContext, TenantTransaction } from "../server";
import type { QueryResult } from "pg";

const alphaContext: TenantContext = {
  clinicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  platformUserId: "11111111-1111-4111-8111-111111111111",
};
const betaContext: TenantContext = {
  clinicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  platformUserId: "22222222-2222-4222-8222-222222222222",
};

function databaseError(code: string): Error & { readonly code: string } {
  return Object.assign(new Error("postgresql://user:secret@db.example.test/private"), { code });
}

function createContextTransaction() {
  let activeContext: TenantContext | undefined;
  const queries: Array<{ readonly text: string; readonly values?: readonly unknown[] }> = [];
  const query = vi.fn((text: string, values?: readonly unknown[]): Promise<QueryResult> => {
    queries.push(values ? { text, values } : { text });

    if (text.includes("set_tenant_context")) {
      const requested = {
        platformUserId: values?.[0] as string,
        clinicId: values?.[1] as string,
      };

      if (
        activeContext &&
        (activeContext.clinicId !== requested.clinicId ||
          activeContext.platformUserId !== requested.platformUserId)
      ) {
        return Promise.reject(databaseError("25001"));
      }

      activeContext = requested;
      return Promise.resolve({ rows: [] } as unknown as QueryResult);
    }

    if (text.includes("current_platform_user_id")) {
      return Promise.resolve({
        rows: [
          {
            clinic_id: activeContext?.clinicId ?? null,
            platform_user_id: activeContext?.platformUserId ?? null,
          },
        ],
      } as unknown as QueryResult);
    }

    if (text.includes("write_clinic_audit_event")) {
      return Promise.resolve({
        rows: [{ audit_event_id: "99999999-9999-4999-8999-999999999999" }],
      } as unknown as QueryResult);
    }

    return Promise.resolve({ rows: [] } as unknown as QueryResult);
  });

  return {
    query,
    queries,
    transaction: { query } as unknown as TenantTransaction,
  };
}

describe("tenant context validation", () => {
  it("accepts an opaque tenant UUID", () => {
    expect(validateTenantIdentifier(alphaContext.clinicId)).toBe(alphaContext.clinicId);
  });

  it.each(["clinic-alpha", "", "../tenant", "https://tenant.example.test"])(
    "rejects unsafe tenant identifier %s",
    (identifier) => {
      expect(() => validateTenantIdentifier(identifier)).toThrowError(
        expect.objectContaining<Partial<TenantBoundaryError>>({
          code: "INVALID_TENANT_IDENTIFIER",
        }),
      );
    },
  );

  it("validates both trusted context identifiers", () => {
    expect(assertTenantContext(alphaContext)).toEqual(alphaContext);
    expect(() => assertTenantContext({ ...alphaContext, platformUserId: "invalid" })).toThrowError(
      expect.objectContaining<Partial<TenantBoundaryError>>({
        code: "INVALID_TENANT_IDENTIFIER",
      }),
    );
  });
});

describe("tenant transaction reuse", () => {
  it("establishes context through the owner-only parameterised function", async () => {
    const { queries, transaction } = createContextTransaction();

    await establishTenantContext(transaction, alphaContext);

    expect(queries).toEqual([
      {
        text: "select graftvision_private.set_tenant_context($1::uuid, $2::uuid)",
        values: [alphaContext.platformUserId, alphaContext.clinicId],
      },
    ]);
  });

  it("allows explicit same-context reuse on one transaction", async () => {
    const { query, transaction } = createContextTransaction();

    await reuseTenantTransaction(transaction, alphaContext, async (trusted) => {
      await reuseTenantTransaction(trusted, alphaContext, () => Promise.resolve());
    });

    expect(query).toHaveBeenCalledTimes(2);
  });

  it("rejects a cross-clinic nested context", async () => {
    const { transaction } = createContextTransaction();

    await expect(
      reuseTenantTransaction(transaction, alphaContext, (trusted) =>
        reuseTenantTransaction(trusted, betaContext, () => Promise.resolve()),
      ),
    ).rejects.toEqual(new TenantBoundaryError("TENANT_CONTEXT_SWITCH_REJECTED"));
  });

  it("rejects an actor switch within the same clinic", async () => {
    const { transaction } = createContextTransaction();

    await expect(
      reuseTenantTransaction(transaction, alphaContext, (trusted) =>
        reuseTenantTransaction(
          trusted,
          { ...alphaContext, platformUserId: betaContext.platformUserId },
          () => Promise.resolve(),
        ),
      ),
    ).rejects.toMatchObject({ code: "TENANT_CONTEXT_SWITCH_REJECTED" });
  });

  it("maps inactive or suspended membership without leaking database details", async () => {
    const transaction = {
      query: vi.fn(() => Promise.reject(databaseError("42501"))),
    } as unknown as TenantTransaction;

    await expect(establishTenantContext(transaction, alphaContext)).rejects.toEqual(
      new TenantBoundaryError("TENANT_MEMBERSHIP_REQUIRED"),
    );
  });

  it("redacts unexpected context setup failures", async () => {
    const transaction = {
      query: vi.fn(() => Promise.reject(databaseError("XX000"))),
    } as unknown as TenantTransaction;

    await expect(establishTenantContext(transaction, alphaContext)).rejects.toEqual(
      new TenantBoundaryError("TENANT_CONTEXT_SETUP_FAILED"),
    );
  });

  it("requires active membership through the reusable assertion", async () => {
    const healthy = createContextTransaction();
    await expect(assertActiveTenantContext(healthy.transaction)).resolves.toBeUndefined();

    const denied = {
      query: vi.fn(() => Promise.reject(databaseError("42501"))),
    } as unknown as TenantTransaction;
    await expect(assertActiveTenantContext(denied)).rejects.toMatchObject({
      code: "TENANT_MEMBERSHIP_REQUIRED",
    });
  });

  it("reads the original trusted context without accepting caller overrides", async () => {
    const { transaction } = createContextTransaction();
    await establishTenantContext(transaction, alphaContext);

    await expect(getTrustedTenantContext(transaction)).resolves.toEqual(alphaContext);
  });

  it("fails safely when trusted context is missing", async () => {
    const { transaction } = createContextTransaction();

    await expect(getTrustedTenantContext(transaction)).rejects.toEqual(
      new TenantBoundaryError("TENANT_CONTEXT_MISSING"),
    );
  });

  it("keeps the audit writer composable in the original transaction", async () => {
    const { queries, transaction } = createContextTransaction();

    const eventId = await reuseTenantTransaction(transaction, alphaContext, (trusted) =>
      writeAuditEvent(trusted, {
        action: "clinic.read",
        outcome: "success",
        resourceId: alphaContext.clinicId,
        resourceType: "clinic",
        sourceApplication: "database",
      }),
    );

    expect(eventId).toBe("99999999-9999-4999-8999-999999999999");
    expect(queries).toHaveLength(2);
    expect(queries[1]?.text).toContain("write_clinic_audit_event");
  });

  it("propagates operation failure so the outer transaction can roll back", async () => {
    const { transaction } = createContextTransaction();
    const operationFailure = new Error("synthetic operation failed");

    await expect(
      reuseTenantTransaction(transaction, alphaContext, () => Promise.reject(operationFailure)),
    ).rejects.toBe(operationFailure);
  });
});
