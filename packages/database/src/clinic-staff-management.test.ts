import { describe, expect, it, vi } from "vitest";

import {
  CLINIC_ADMIN_MANAGED_ROLE_CODES,
  CLINIC_STAFF_EXPIRY_DAYS,
  CLINIC_STAFF_PERMISSION,
  createClinicStaffInvitation,
  hashProviderInvitationReference,
  normalizeClinicStaffEmail,
  setClinicStaffRoles,
  transitionClinicStaffInvitation,
  type TenantTransaction,
} from "./index";

import type { QueryResult } from "pg";

const sessionId = "d4000000-0000-4000-8000-000000000001";
const userId = "d1000000-0000-4000-8000-000000000001";
const invitationId = "d5000000-0000-4000-8000-000000000001";

function transactionReturning(row: unknown): {
  readonly query: ReturnType<typeof vi.fn>;
  readonly transaction: TenantTransaction;
} {
  const query = vi.fn(() => Promise.resolve({ rows: [row] } as unknown as QueryResult));
  return { query, transaction: { query } };
}

describe("clinic staff-management boundary", () => {
  it("preserves approved permission and expiry policy", () => {
    expect(CLINIC_STAFF_PERMISSION).toBe("ADMIN-PERM-003");
    expect(CLINIC_STAFF_EXPIRY_DAYS).toBe(7);
    expect(CLINIC_ADMIN_MANAGED_ROLE_CODES).toEqual([
      "CLINICAL_ASSISTANT",
      "PROCEDURE_TECHNICIAN",
      "RECEPTION",
      "REPORT_COORDINATOR",
      "PRESENTATION",
      "REVIEWER",
    ]);
  });

  it("normalizes email without retaining provider token material", () => {
    expect(normalizeClinicStaffEmail("  Staff@Example.TEST ")).toBe("staff@example.test");
    expect(hashProviderInvitationReference("synthetic-reference-value")).toMatch(/^[a-f0-9]{64}$/u);
  });

  it.each(["invalid", "a@b", "a..b@example.test"])("rejects invalid email %s", (email) => {
    expect(() => normalizeClinicStaffEmail(email)).toThrow("email is invalid");
  });

  it("creates an invitation through the controlled function", async () => {
    const { query, transaction } = transactionReturning({ invitation_id: invitationId });
    await expect(
      createClinicStaffInvitation(transaction, {
        applicationSessionId: sessionId,
        email: "staff@example.test",
        providerIdentityId: userId,
        providerReference: "synthetic-reference-value",
        roleCodes: ["CLINICAL_ASSISTANT"],
      }),
    ).resolves.toBe(invitationId);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("create_clinic_invitation"), [
      sessionId,
      userId,
      "staff@example.test",
      expect.stringMatching(/^[a-f0-9]{64}$/u),
      ["CLINICAL_ASSISTANT"],
      7,
    ]);
  });

  it("rotates resend references through the controlled function", async () => {
    const { query, transaction } = transactionReturning({});
    await transitionClinicStaffInvitation(transaction, {
      action: "resend",
      applicationSessionId: sessionId,
      invitationId,
      providerIdentityId: userId,
      providerReference: "new-synthetic-reference",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("transition_clinic_invitation"), [
      sessionId,
      userId,
      invitationId,
      "resend",
      expect.stringMatching(/^[a-f0-9]{64}$/u),
    ]);
  });

  it("rejects empty and duplicate role sets", async () => {
    const { query, transaction } = transactionReturning({});
    await expect(
      setClinicStaffRoles(transaction, {
        applicationSessionId: sessionId,
        membershipId: invitationId,
        providerIdentityId: userId,
        roleCodes: [],
      }),
    ).rejects.toThrow("roleCodes are invalid");
    expect(query).not.toHaveBeenCalled();
  });
});
