import { describe, expect, it, vi } from "vitest";

import {
  archivePatient,
  PATIENT_ARCHIVE_REASON_CODES,
  PATIENT_LIFECYCLE_PERMISSION,
  PATIENT_LIFECYCLE_STATES,
  PATIENT_RESTORE_REASON_CODES,
  restorePatient,
} from "./patient-lifecycle";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  expectedRevision: 1,
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  patientId: "33333333-3333-4333-8333-333333333333",
  providerIdentityId: "44444444-4444-4444-8444-444444444444",
};

describe("patient lifecycle boundary", () => {
  it("preserves the approved permission, states, and controlled reasons", () => {
    expect(PATIENT_LIFECYCLE_PERMISSION).toBe("PATIENT-PERM-001");
    expect(PATIENT_LIFECYCLE_STATES).toEqual(["current", "archived"]);
    expect(PATIENT_ARCHIVE_REASON_CODES).toHaveLength(6);
    expect(PATIENT_RESTORE_REASON_CODES).toHaveLength(4);
  });

  it("archives through the controlled database boundary", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          lifecycle_revision: 2,
          lifecycle_state: "archived",
          patient_id: context.patientId,
        },
      ],
    });
    await expect(
      archivePatient({ query }, { ...context, reasonCode: "patient_requested_inactive_record" }),
    ).resolves.toEqual({
      lifecycleRevision: 2,
      lifecycleState: "archived",
      patientId: context.patientId,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("transition_patient_lifecycle"), [
      context.applicationSessionId,
      context.providerIdentityId,
      context.patientId,
      1,
      "archived",
      "patient_requested_inactive_record",
      context.idempotencyKey,
    ]);
  });

  it("restores and rejects forged or uncontrolled inputs", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          lifecycle_revision: 3,
          lifecycle_state: "current",
          patient_id: context.patientId,
        },
      ],
    });
    await expect(
      restorePatient(
        { query },
        { ...context, expectedRevision: 2, reasonCode: "patient_returned" },
      ),
    ).resolves.toMatchObject({ lifecycleRevision: 3, lifecycleState: "current" });
    await expect(
      archivePatient(
        { query },
        { ...context, patientId: "forged", reasonCode: "administrative_cleanup" },
      ),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
    await expect(
      archivePatient({ query }, { ...context, reasonCode: "patient_returned" as never }),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});
