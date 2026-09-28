import { describe, expect, it, vi } from "vitest";

import {
  CLINIC_LIFECYCLE_PERMISSION,
  createClinic,
  transitionClinicStatus,
  type TenantTransaction,
} from "./index";

import type { QueryResult } from "pg";

const sessionId = "d4000000-0000-4000-8000-000000000001";
const providerIdentityId = "d1000000-0000-4000-8000-000000000001";
const clinicId = "d2000000-0000-4000-8000-000000000001";

function transactionReturning(row: unknown): {
  readonly query: ReturnType<typeof vi.fn>;
  readonly transaction: TenantTransaction;
} {
  const query = vi.fn(() => Promise.resolve({ rows: [row] } as unknown as QueryResult));
  return { query, transaction: { query } };
}

describe("clinic lifecycle server boundary", () => {
  it("uses the approved existing platform permission", () => {
    expect(CLINIC_LIFECYCLE_PERMISSION).toBe("ADMIN-PERM-006");
  });

  it("creates a clinic through the controlled database function", async () => {
    const { query, transaction } = transactionReturning({ clinic_id: clinicId });

    await expect(
      createClinic(transaction, {
        applicationSessionId: sessionId,
        clinicCode: "face-lahore",
        displayName: "FACE Aesthetic Clinic Lahore",
        initialStatus: "active",
        providerIdentityId,
        timezone: "Asia/Karachi",
      }),
    ).resolves.toBe(clinicId);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("create_clinic"), [
      sessionId,
      providerIdentityId,
      "face-lahore",
      "FACE Aesthetic Clinic Lahore",
      "Asia/Karachi",
      "active",
    ]);
  });

  it.each(["Admin", " admin", "a", "graftvision"])(
    "rejects invalid or prohibited clinic code %s",
    async (clinicCode) => {
      const { query, transaction } = transactionReturning({ clinic_id: clinicId });
      await expect(
        createClinic(transaction, {
          applicationSessionId: sessionId,
          clinicCode,
          displayName: "Valid Clinic",
          initialStatus: "active",
          providerIdentityId,
          timezone: "Asia/Karachi",
        }),
      ).rejects.toThrow("clinicCode is invalid");
      expect(query).not.toHaveBeenCalled();
    },
  );

  it("rejects unsafe clinic names before the database call", async () => {
    const { query, transaction } = transactionReturning({ clinic_id: clinicId });
    await expect(
      createClinic(transaction, {
        applicationSessionId: sessionId,
        clinicCode: "valid-clinic",
        displayName: "test",
        initialStatus: "active",
        providerIdentityId,
        timezone: "Asia/Karachi",
      }),
    ).rejects.toThrow("displayName is invalid");
    expect(query).not.toHaveBeenCalled();
  });

  it("transitions status through the controlled database function", async () => {
    const { query, transaction } = transactionReturning({ transitioned: true });
    await expect(
      transitionClinicStatus(transaction, {
        applicationSessionId: sessionId,
        clinicId,
        newStatus: "suspended",
        providerIdentityId,
        reasonCode: "OPERATIONAL_HOLD",
      }),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("transition_clinic_status"), [
      sessionId,
      providerIdentityId,
      clinicId,
      "suspended",
      "OPERATIONAL_HOLD",
    ]);
  });

  it("rejects forged identifiers before the database call", async () => {
    const { query, transaction } = transactionReturning({ transitioned: true });
    await expect(
      transitionClinicStatus(transaction, {
        applicationSessionId: "forged",
        clinicId,
        newStatus: "inactive",
        providerIdentityId,
        reasonCode: "PLATFORM_INACTIVATED",
      }),
    ).rejects.toThrow("applicationSessionId must be a valid UUID");
    expect(query).not.toHaveBeenCalled();
  });
});
