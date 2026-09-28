import { describe, expect, it, vi } from "vitest";

import { hasDoctorAuthority, transitionDoctorVerification, type TenantTransaction } from "./index";

import type { QueryResult } from "pg";

const sessionId = "d4000000-0000-4000-8000-000000000001";
const targetPlatformUserId = "d1000000-0000-4000-8000-000000000003";
const verificationId = "d5000000-0000-4000-8000-000000000001";

function transactionReturning(row: unknown): {
  readonly query: ReturnType<typeof vi.fn>;
  readonly transaction: TenantTransaction;
} {
  const query = vi.fn(() => Promise.resolve({ rows: [row] } as unknown as QueryResult));
  const transaction: TenantTransaction = { query };
  return { query, transaction };
}

describe("Doctor verification server boundary", () => {
  it("calls the controlled transition with restricted evidence metadata", async () => {
    const { query, transaction } = transactionReturning({
      verification_id: verificationId,
    });

    await expect(
      transitionDoctorVerification(transaction, {
        evidenceType: "professional_registration",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        internalNote: "Controlled review note",
        issuingAuthority: "Synthetic authority",
        newStatus: "verified",
        reasonCode: "VERIFICATION_APPROVED",
        referenceIdentifier: "SYNTHETIC-REFERENCE",
        sessionId,
        targetPlatformUserId,
      }),
    ).resolves.toBe(verificationId);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("transition_doctor_verification"),
      expect.arrayContaining([sessionId, targetPlatformUserId, "verified"]),
    );
  });

  it("rejects verified state without controlled evidence metadata", async () => {
    const { transaction } = transactionReturning({ verification_id: verificationId });

    await expect(
      transitionDoctorVerification(transaction, {
        newStatus: "verified",
        reasonCode: "VERIFICATION_APPROVED",
        sessionId,
        targetPlatformUserId,
      }),
    ).rejects.toThrow("Verified status requires controlled evidence metadata");
  });

  it("rejects oversized internal notes before the database call", async () => {
    const { query, transaction } = transactionReturning({
      verification_id: verificationId,
    });

    await expect(
      transitionDoctorVerification(transaction, {
        internalNote: "x".repeat(281),
        newStatus: "pending",
        reasonCode: "INITIAL_REVIEW",
        sessionId,
        targetPlatformUserId,
      }),
    ).rejects.toThrow("internalNote is invalid");
    expect(query).not.toHaveBeenCalled();
  });

  it("checks Doctor authority through the database predicate", async () => {
    const { query, transaction } = transactionReturning({ allowed: true });

    await expect(hasDoctorAuthority(transaction, sessionId, "ROLE-001")).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("has_doctor_authority"), [
      sessionId,
      "ROLE-001",
    ]);
  });

  it("rejects invalid permission identifiers", async () => {
    const { query, transaction } = transactionReturning({ allowed: false });

    await expect(hasDoctorAuthority(transaction, sessionId, "role claim")).rejects.toThrow(
      "requiredPermission is invalid",
    );
    expect(query).not.toHaveBeenCalled();
  });
});
