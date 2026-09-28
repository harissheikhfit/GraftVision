import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_CONSENT_PERMISSION,
  readPatientPrivacyAcknowledgement,
  recordPatientPrivacyAcknowledgement,
  withdrawPatientPrivacyAcknowledgement,
} from "./patient-consent";

const id = "10000000-0000-4000-8000-000000000001";
const transaction = (result: unknown) => {
  const query = vi.fn().mockResolvedValue({ rows: [{ result }] });
  return { query };
};

describe("patient privacy acknowledgement boundary", () => {
  it("keeps the temporary permission boundary explicit", () => {
    expect(PATIENT_CONSENT_PERMISSION).toBe("PATIENT-PERM-001");
  });

  it("reads the controlled privacy projection", async () => {
    const tx = transaction({ current: null, notices: [] });
    await expect(
      readPatientPrivacyAcknowledgement(tx, {
        applicationSessionId: id,
        patientId: id,
        providerIdentityId: id,
      }),
    ).resolves.toEqual({ current: null, notices: [] });
  });

  it("records and withdraws through controlled functions", async () => {
    const tx = transaction({ id, noticeVersionId: id, revision: 1, status: "acknowledged" });
    await recordPatientPrivacyAcknowledgement(tx, {
      applicationSessionId: id,
      channel: "IN_PERSON_CLINIC",
      expectedRevision: 0,
      idempotencyKey: id,
      language: "en",
      noticeVersionId: id,
      patientId: id,
      providerIdentityId: id,
    });
    await withdrawPatientPrivacyAcknowledgement(tx, {
      applicationSessionId: id,
      expectedRevision: 1,
      idempotencyKey: id,
      patientId: id,
      providerIdentityId: id,
    });
    expect(tx.query).toHaveBeenCalledTimes(2);
  });
});
