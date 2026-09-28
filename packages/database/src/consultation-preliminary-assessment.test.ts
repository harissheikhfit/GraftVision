import { describe, expect, it, vi } from "vitest";

import {
  PRELIMINARY_ASSESSMENT_REVIEW_STATES,
  savePreliminaryAssessment,
  transitionPreliminaryAssessmentReview,
} from "./consultation-preliminary-assessment";

import type { TenantTransaction } from "./server";

describe("consultation preliminary assessment boundary", () => {
  const context = {
    sessionId: "11111111-1111-4111-8111-111111111111",
    actorId: "33333333-3333-4333-8333-333333333333",
  };

  const mockPayload = {
    consultationId: "22222222-2222-4222-8222-222222222222",
    expectedRevision: 0,
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
    patientMedicalHistoryVersionId: "55555555-5555-5555-5555-555555555555",
    consultationHairLossHistoryVersionId: "66666666-6666-6666-6666-666666666666",
    consultationRevision: 1,
    patternClassification: "type-3",
    certaintyCode: "clinician-observed",
    sourceCode: "observed",
    limitedClarification: null,
    frontalInvolvementStatus: "yes",
    temporalInvolvementStatus: "yes",
    midScalpInvolvementStatus: "no",
    crownInvolvementStatus: "no",
    diffuseInvolvementStatus: "no",
    recipientObservationSummary: null,
    donorAreaConcernStatus: "none-reported",
    donorLimitationStatus: "none-reported",
    previousDonorProcedureEvidenceStatus: "none-reported",
    donorObservationSummary: null,
    activeScalpSymptomConcern: "none",
    visibleScalpConditionConcern: "none",
    unresolvedMedicalWarningStatus: "none",
    additionalInformationRequiredStatus: "none",
    warningCodes: [],
    safetyObservationSummary: null,
  };

  it("preserves the approved review states", () => {
    expect(PRELIMINARY_ASSESSMENT_REVIEW_STATES).toEqual([
      "draft",
      "doctor_reviewed",
      "superseded",
      "retracted",
    ]);
  });

  it("calls transaction.query to save preliminary assessment", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          assessment_id: "77777777-7777-7777-7777-777777777777",
          outcome_code: "success",
          revision: 1,
          version_id: "88888888-8888-8888-8888-888888888888",
          review_state: "draft",
          material_change: false,
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await savePreliminaryAssessment(
      transaction,
      context.sessionId,
      context.actorId,
      mockPayload,
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual({
      assessmentId: "77777777-7777-7777-7777-777777777777",
      outcome: "success",
      revision: 1,
      versionId: "88888888-8888-8888-8888-888888888888",
      reviewState: "draft",
      materialChange: false,
    });
  });

  it("calls transaction.query to transition preliminary assessment review", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          outcome_code: "success",
          review_state: "doctor_reviewed",
          revision: 1,
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await transitionPreliminaryAssessmentReview(
      transaction,
      context.sessionId,
      context.actorId,
      mockPayload.consultationId,
      1,
      mockPayload.idempotencyKey,
      "doctor_reviewed",
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual({ outcome: "success", reviewState: "doctor_reviewed", revision: 1 });
  });
});
