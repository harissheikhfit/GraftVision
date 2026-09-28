import { describe, expect, it, vi } from "vitest";

import {
  changePatientStatus,
  createPatientRoot,
  PATIENT_PROVENANCE_CODES,
  PATIENT_ROOT_PERMISSION,
  PATIENT_ROOT_STATUSES,
  readPatientRoot,
} from "./patient-foundation";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};
const patientRow = {
  created_at: new Date("2026-07-28T00:00:00Z"),
  id: "33333333-3333-4333-8333-333333333333",
  patient_number: "GV-000001",
  revision: 1,
  status: "active",
  updated_at: new Date("2026-07-28T00:00:00Z"),
} as const;

describe("patient root boundary", () => {
  it("preserves the approved permission, statuses, and provenance", () => {
    expect(PATIENT_ROOT_PERMISSION).toBe("PATIENT-PERM-001");
    expect(PATIENT_ROOT_STATUSES).toEqual(["active", "inactive"]);
    expect(PATIENT_PROVENANCE_CODES).toEqual(["MANUAL_REGISTRATION"]);
  });

  it("returns only the approved privacy-safe projection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [patientRow] });
    const result = await createPatientRoot(
      { query },
      {
        ...context,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        provenanceCode: "MANUAL_REGISTRATION",
        status: "active",
      },
    );
    expect(result).toEqual({
      createdAt: patientRow.created_at,
      id: patientRow.id,
      patientNumber: "GV-000001",
      revision: 1,
      status: "active",
      updatedAt: patientRow.updated_at,
    });
    expect(Object.keys(result).sort()).toEqual([
      "createdAt",
      "id",
      "patientNumber",
      "revision",
      "status",
      "updatedAt",
    ]);
  });

  it("reads only through the controlled same-context function", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [patientRow] });
    await expect(
      readPatientRoot(
        { query },
        {
          ...context,
          patientId: patientRow.id,
        },
      ),
    ).resolves.toMatchObject({ id: patientRow.id, patientNumber: "GV-000001" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.read_patient_root"),
      expect.arrayContaining([patientRow.id]),
    );
  });

  it("uses optimistic concurrency for status changes", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: "updated" }] });
    await expect(
      changePatientStatus(
        { query },
        {
          ...context,
          expectedRevision: 1,
          patientId: patientRow.id,
          status: "inactive",
        },
      ),
    ).resolves.toBe("updated");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.change_patient_status"),
      expect.arrayContaining([1, "inactive"]),
    );
  });

  it("rejects forged context and invalid idempotency before querying", async () => {
    await expect(
      createPatientRoot(
        { query: vi.fn() },
        {
          ...context,
          applicationSessionId: "forged",
          idempotencyKey: "not-a-key",
          provenanceCode: "MANUAL_REGISTRATION",
          status: "active",
        },
      ),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});
