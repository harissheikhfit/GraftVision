import { describe, expect, it, vi } from "vitest";

import {
  completeConsultation,
  reopenConsultation,
  getConsultationAnalyzerReadiness,
  readLifecycleEvents,
  readLifecycleEventsClinical,
} from "./consultation-completion";

import type { TenantTransaction } from "./server";

describe("consultation completion boundary", () => {
  const context = {
    sessionId: "11111111-1111-4111-8111-111111111111",
    actorId: "33333333-3333-4333-8333-333333333333",
    clinicId: "22222222-2222-4222-8222-222222222222",
  };

  const mockPayload = {
    consultationId: "99999999-9999-4999-8999-999999999999",
    expectedRevision: 1,
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
  };

  it("calls transaction.query to complete consultation", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          outcome_code: "success",
          revision: 2,
          medical_history_version_id: "55555555-5555-5555-5555-555555555555",
          hair_loss_history_version_id: "66666666-6666-6666-6666-666666666666",
          preliminary_assessment_version_id: "77777777-7777-7777-7777-777777777777",
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await completeConsultation(
      transaction,
      context.sessionId,
      context.actorId,
      mockPayload,
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual({
      outcomeCode: "success",
      revision: 2,
      medicalHistoryVersionId: "55555555-5555-5555-5555-555555555555",
      hairLossHistoryVersionId: "66666666-6666-6666-6666-666666666666",
      preliminaryAssessmentVersionId: "77777777-7777-7777-7777-777777777777",
    });
  });

  it("handles consultation complete expected errors (access denied)", async () => {
    const error = new Error("Access Denied") as Error & { code: string };
    error.code = "42501";

    const queryMock = vi.fn().mockRejectedValue(error);
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await completeConsultation(
      transaction,
      context.sessionId,
      context.actorId,
      mockPayload,
    );

    expect(result.outcomeCode).toBe("CONSULTATION_ACCESS_DENIED");
  });

  it("handles consultation complete expected errors (not found)", async () => {
    const error = new Error("Not Found") as Error & { code: string };
    error.code = "P0002";

    const queryMock = vi.fn().mockRejectedValue(error);
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await completeConsultation(
      transaction,
      context.sessionId,
      context.actorId,
      mockPayload,
    );

    expect(result.outcomeCode).toBe("CONSULTATION_NOT_FOUND");
  });

  it("calls transaction.query to reopen consultation", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          outcome_code: "success",
          revision: 3,
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await reopenConsultation(transaction, context.sessionId, context.actorId, {
      ...mockPayload,
      reopenReasonCode: "NEW_RELEVANT_INFORMATION",
    });

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual({
      outcomeCode: "success",
      revision: 3,
    });
  });

  it("calls transaction.query to get analyzer readiness", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          is_ready: true,
          last_completed_at: new Date("2026-07-31T00:00:00Z"),
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await getConsultationAnalyzerReadiness(
      transaction,
      context.clinicId,
      mockPayload.consultationId,
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual({
      isReady: true,
      lastCompletedAt: new Date("2026-07-31T00:00:00Z"),
    });
  });

  it("calls transaction.query to get safe lifecycle events", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          clinic_id: context.clinicId,
          consultation_id: mockPayload.consultationId,
          event_type: "completed",
          consultation_revision: 2,
          occurred_at: new Date("2026-07-31T00:00:00Z"),
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await readLifecycleEvents(
      transaction,
      context.sessionId,
      context.actorId,
      context.clinicId,
      mockPayload.consultationId,
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual([
      {
        clinicId: context.clinicId,
        consultationId: mockPayload.consultationId,
        eventType: "completed",
        consultationRevision: 2,
        occurredAt: new Date("2026-07-31T00:00:00Z"),
      },
    ]);
  });

  it("calls transaction.query to get clinical lifecycle events", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          clinic_id: context.clinicId,
          consultation_id: mockPayload.consultationId,
          event_type: "reopened",
          consultation_revision: 3,
          medical_history_version_id: null,
          hair_loss_history_version_id: null,
          preliminary_assessment_version_id: null,
          reopen_reason_code: "WORKFLOW_RECOVERY",
          actor_platform_user_id: context.actorId,
          occurred_at: new Date("2026-07-31T01:00:00Z"),
        },
      ],
    });
    const transaction = { query: queryMock } as unknown as TenantTransaction;

    const result = await readLifecycleEventsClinical(
      transaction,
      context.sessionId,
      context.actorId,
      context.clinicId,
      mockPayload.consultationId,
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result).toEqual([
      {
        clinicId: context.clinicId,
        consultationId: mockPayload.consultationId,
        eventType: "reopened",
        consultationRevision: 3,
        medicalHistoryVersionId: null,
        hairLossHistoryVersionId: null,
        preliminaryAssessmentVersionId: null,
        reopenReasonCode: "WORKFLOW_RECOVERY",
        actorPlatformUserId: context.actorId,
        occurredAt: new Date("2026-07-31T01:00:00Z"),
      },
    ]);
  });
});
