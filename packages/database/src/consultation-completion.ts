import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export type ConsultationCompletionOutcome =
  | "success"
  | "stale_revision"
  | "INVALID_TRANSITION"
  | "CLINICAL_EVIDENCE_NOT_READY"
  | "ASSESSMENT_BINDING_MISMATCH"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_ACCESS_DENIED";

export interface CompleteConsultationResponse {
  outcomeCode: ConsultationCompletionOutcome;
  revision: number;
  medicalHistoryVersionId: string | null;
  hairLossHistoryVersionId: string | null;
  preliminaryAssessmentVersionId: string | null;
}

export interface ReopenConsultationResponse {
  outcomeCode: ConsultationCompletionOutcome | "REOPEN_REASON_REQUIRED";
  revision: number;
}

export type ReopenReasonCode =
  | "PATIENT_INFORMATION_UPDATED"
  | "CLINICAL_HISTORY_UPDATED"
  | "ASSESSMENT_REVISION_REQUIRED"
  | "CLERICAL_CORRECTION"
  | "NEW_RELEVANT_INFORMATION"
  | "WORKFLOW_RECOVERY";

export async function completeConsultation(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  payload: {
    consultationId: string;
    expectedRevision: number;
    idempotencyKey: string;
  },
): Promise<CompleteConsultationResponse> {
  try {
    const result = await transaction.query<{
      outcome_code: string;
      revision: number;
      medical_history_version_id: string | null;
      hair_loss_history_version_id: string | null;
      preliminary_assessment_version_id: string | null;
    }>(
      `select * from graftvision_private.complete_consultation(
        $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid
      )`,
      [
        sessionId,
        actorId,
        payload.consultationId,
        payload.expectedRevision,
        payload.idempotencyKey,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new DatabaseBoundaryError("Consultation completion failed.");
    return {
      outcomeCode: row.outcome_code as ConsultationCompletionOutcome,
      revision: row.revision,
      medicalHistoryVersionId: row.medical_history_version_id,
      hairLossHistoryVersionId: row.hair_loss_history_version_id,
      preliminaryAssessmentVersionId: row.preliminary_assessment_version_id,
    };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "42501")
      return {
        outcomeCode: "CONSULTATION_ACCESS_DENIED",
        revision: 0,
        medicalHistoryVersionId: null,
        hairLossHistoryVersionId: null,
        preliminaryAssessmentVersionId: null,
      };
    if (err.code === "P0002")
      return {
        outcomeCode: "CONSULTATION_NOT_FOUND",
        revision: 0,
        medicalHistoryVersionId: null,
        hairLossHistoryVersionId: null,
        preliminaryAssessmentVersionId: null,
      };
    throw error;
  }
}

export async function reopenConsultation(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  payload: {
    consultationId: string;
    expectedRevision: number;
    idempotencyKey: string;
    reopenReasonCode: ReopenReasonCode;
  },
): Promise<ReopenConsultationResponse> {
  try {
    const result = await transaction.query<{
      outcome_code: string;
      revision: number;
    }>(
      `select * from graftvision_private.reopen_consultation(
        $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid, $6::text
      )`,
      [
        sessionId,
        actorId,
        payload.consultationId,
        payload.expectedRevision,
        payload.idempotencyKey,
        payload.reopenReasonCode,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new DatabaseBoundaryError("Consultation reopen failed.");
    return {
      outcomeCode: row.outcome_code as ConsultationCompletionOutcome,
      revision: row.revision,
    };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "42501") return { outcomeCode: "CONSULTATION_ACCESS_DENIED", revision: 0 };
    if (err.code === "P0002") return { outcomeCode: "CONSULTATION_NOT_FOUND", revision: 0 };
    if (err.code === "22023") return { outcomeCode: "REOPEN_REASON_REQUIRED", revision: 0 };
    throw error;
  }
}

export interface ConsultationAnalyzerReadiness {
  isReady: boolean;
  lastCompletedAt: Date | null;
}

export async function getConsultationAnalyzerReadiness(
  transaction: TenantTransaction,
  clinicId: string,
  consultationId: string,
): Promise<ConsultationAnalyzerReadiness | null> {
  const result = await transaction.query<{
    is_ready: boolean;
    last_completed_at: Date | null;
  }>(`select * from graftvision_private.read_consultation_analyzer_readiness($1::uuid, $2::uuid)`, [
    clinicId,
    consultationId,
  ]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    isReady: row.is_ready,
    lastCompletedAt: row.last_completed_at,
  };
}

export interface ConsultationLifecycleEventSafeProjection {
  clinicId: string;
  consultationId: string;
  eventType: "completed" | "reopened";
  consultationRevision: number;
  occurredAt: Date;
}

export async function readLifecycleEvents(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  clinicId: string,
  consultationId: string,
): Promise<ConsultationLifecycleEventSafeProjection[]> {
  const result = await transaction.query<{
    clinic_id: string;
    consultation_id: string;
    event_type: "completed" | "reopened";
    consultation_revision: number;
    occurred_at: Date;
  }>(
    `select * from graftvision_private.read_lifecycle_events($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    [sessionId, actorId, clinicId, consultationId],
  );

  return result.rows.map((row) => ({
    clinicId: row.clinic_id,
    consultationId: row.consultation_id,
    eventType: row.event_type,
    consultationRevision: row.consultation_revision,
    occurredAt: row.occurred_at,
  }));
}

export interface ConsultationLifecycleEventClinicalProjection {
  clinicId: string;
  consultationId: string;
  eventType: "completed" | "reopened";
  consultationRevision: number;
  medicalHistoryVersionId: string | null;
  hairLossHistoryVersionId: string | null;
  preliminaryAssessmentVersionId: string | null;
  reopenReasonCode: string | null;
  actorPlatformUserId: string;
  occurredAt: Date;
}

export async function readLifecycleEventsClinical(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  clinicId: string,
  consultationId: string,
): Promise<ConsultationLifecycleEventClinicalProjection[]> {
  const result = await transaction.query<{
    clinic_id: string;
    consultation_id: string;
    event_type: "completed" | "reopened";
    consultation_revision: number;
    medical_history_version_id: string | null;
    hair_loss_history_version_id: string | null;
    preliminary_assessment_version_id: string | null;
    reopen_reason_code: string | null;
    actor_platform_user_id: string;
    occurred_at: Date;
  }>(
    `select * from graftvision_private.read_lifecycle_events_clinical($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    [sessionId, actorId, clinicId, consultationId],
  );

  return result.rows.map((row) => ({
    clinicId: row.clinic_id,
    consultationId: row.consultation_id,
    eventType: row.event_type,
    consultationRevision: row.consultation_revision,
    medicalHistoryVersionId: row.medical_history_version_id,
    hairLossHistoryVersionId: row.hair_loss_history_version_id,
    preliminaryAssessmentVersionId: row.preliminary_assessment_version_id,
    reopenReasonCode: row.reopen_reason_code,
    actorPlatformUserId: row.actor_platform_user_id,
    occurredAt: row.occurred_at,
  }));
}
