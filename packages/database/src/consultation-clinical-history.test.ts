import { describe, expect, it, vi } from "vitest";

import {
  CLINICAL_CERTAINTY_CODES,
  CLINICAL_REVIEW_STATES,
  CLINICAL_SOURCE_CODES,
  HAIR_LOSS_CONCERNS,
  MEDICAL_CONDITION_STATUSES,
  saveMedicalHistory,
} from "./consultation-clinical-history";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  consultationId: "22222222-2222-4222-8222-222222222222",
  providerIdentityId: "33333333-3333-4333-8333-333333333333",
};

describe("consultation clinical-history boundary", () => {
  it("preserves the approved reduced vocabularies", () => {
    expect(CLINICAL_REVIEW_STATES).toEqual([
      "draft",
      "submitted-for-review",
      "Doctor-reviewed",
      "amendment-required",
      "superseded",
      "retracted",
    ]);
    expect(CLINICAL_SOURCE_CODES).toContain("patient-reported");
    expect(CLINICAL_SOURCE_CODES).toContain("system-suggested");
    expect(CLINICAL_CERTAINTY_CODES).toContain("not-assessed");
    expect(MEDICAL_CONDITION_STATUSES).toContain("no-known-significant-condition");
    expect(HAIR_LOSS_CONCERNS).toContain("previous-transplant-concern");
  });

  it("requires detail for a reported allergy before reaching the database", async () => {
    const query = vi.fn();
    await expect(
      saveMedicalHistory(
        { query },
        {
          ...context,
          allergyStatus: "allergy-reported",
          anaesthesiaIssueStatus: "not-assessed",
          bleedingConcernStatus: "not-assessed",
          certaintyCode: "reported",
          expectedRevision: 0,
          healingConcernStatus: "not-assessed",
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          medicalConditionStatus: "not-assessed",
          medicationStatus: "not-assessed",
          previousOperationStatus: "not-assessed",
          sourceCode: "patient-reported",
          warningCodes: [],
        },
      ),
    ).rejects.toThrow("Reported allergy detail is required.");
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a privacy-safe stale result without clinical values", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          changed_fields: ["medical_history"],
          history_id: context.consultationId,
          material_change: false,
          outcome_code: "stale_revision",
          review_state: "draft",
          revision: 2,
          version_id: null,
        },
      ],
    });
    const result = await saveMedicalHistory(
      { query },
      {
        ...context,
        allergyStatus: "none-reported",
        anaesthesiaIssueStatus: "not-assessed",
        bleedingConcernStatus: "not-assessed",
        certaintyCode: "reported",
        expectedRevision: 1,
        healingConcernStatus: "not-assessed",
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        medicalConditionStatus: "not-assessed",
        medicationStatus: "none-reported",
        previousOperationStatus: "not-assessed",
        sourceCode: "patient-reported",
        warningCodes: [],
      },
    );
    expect(result).toEqual({
      changedFields: ["medical_history"],
      historyId: context.consultationId,
      materialChange: false,
      outcome: "stale-revision",
      reviewState: "draft",
      revision: 2,
      versionId: null,
    });
  });
});
