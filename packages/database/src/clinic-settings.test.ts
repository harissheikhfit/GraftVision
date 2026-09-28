import { describe, expect, it, vi } from "vitest";

import {
  CLINIC_SETTINGS_PERMISSION,
  readClinicSettings,
  updateClinicSettings,
  type TenantTransaction,
} from "./index";

import type { QueryResult } from "pg";

const context = {
  applicationSessionId: "d4000000-0000-4000-8000-000000000001",
  providerIdentityId: "d1000000-0000-4000-8000-000000000001",
};

function transactionReturning(row: unknown) {
  const result: QueryResult = {
    command: "SELECT",
    fields: [],
    oid: 0,
    rowCount: 1,
    rows: [row],
  };
  const query = vi.fn(() => Promise.resolve(result));
  const transaction: TenantTransaction = { query };
  return { query, transaction };
}

describe("clinic settings boundary", () => {
  it("uses the approved permission", () => {
    expect(CLINIC_SETTINGS_PERMISSION).toBe("ADMIN-PERM-001");
  });

  it("maps the typed read projection", async () => {
    const updatedAt = new Date();
    const { transaction } = transactionReturning({
      clinic_code: "face-lahore",
      clinic_id: "d2000000-0000-4000-8000-000000000001",
      display_name: "FACE Aesthetic Clinic Lahore",
      revision: 2,
      timezone: "Asia/Karachi",
      updated_at: updatedAt,
      updated_by_platform_user_id: context.providerIdentityId,
    });
    await expect(readClinicSettings(transaction, context)).resolves.toMatchObject({
      clinicCode: "face-lahore",
      revision: 2,
      timezone: "Asia/Karachi",
    });
  });

  it("updates with an expected revision through the controlled function", async () => {
    const { query, transaction } = transactionReturning({ result: "updated" });
    await expect(
      updateClinicSettings(transaction, {
        ...context,
        displayName: "FACE Clinic Lahore",
        expectedRevision: 2,
        timezone: "Asia/Karachi",
      }),
    ).resolves.toBe("updated");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("update_clinic_settings"), [
      context.applicationSessionId,
      context.providerIdentityId,
      2,
      "FACE Clinic Lahore",
      "Asia/Karachi",
    ]);
  });

  it.each(["", " test", "test"])("rejects invalid display name %s", async (displayName) => {
    const { query, transaction } = transactionReturning({ result: "updated" });
    await expect(
      updateClinicSettings(transaction, {
        ...context,
        displayName,
        expectedRevision: 1,
        timezone: "Asia/Karachi",
      }),
    ).rejects.toThrow("displayName is invalid");
    expect(query).not.toHaveBeenCalled();
  });

  it.each(["Karachi", "../Asia/Karachi", "Asia Karachi"])(
    "rejects unsafe timezone %s",
    async (timezone) => {
      const { query, transaction } = transactionReturning({ result: "updated" });
      await expect(
        updateClinicSettings(transaction, {
          ...context,
          displayName: "Valid Clinic",
          expectedRevision: 1,
          timezone,
        }),
      ).rejects.toThrow("timezone is invalid");
      expect(query).not.toHaveBeenCalled();
    },
  );
});
