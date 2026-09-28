import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PRELIMINARY_ASSESSMENT_REVIEW_STATES = [
  "draft",
  "doctor_reviewed",
  "superseded",
  "retracted",
] as const;

export type PreliminaryAssessmentReviewState =
  (typeof PRELIMINARY_ASSESSMENT_REVIEW_STATES)[number];

export interface SavePreliminaryAssessmentPayload {
  consultationId: string;
  expectedRevision: number;
  idempotencyKey: string;
  patientMedicalHistoryVersionId: string;
  consultationHairLossHistoryVersionId: string;
  consultationRevision: number;
  patternClassification: string | null;
  certaintyCode: string | null;
  sourceCode: string | null;
  limitedClarification: string | null;
  frontalInvolvementStatus: string | null;
  temporalInvolvementStatus: string | null;
  midScalpInvolvementStatus: string | null;
  crownInvolvementStatus: string | null;
  diffuseInvolvementStatus: string | null;
  recipientObservationSummary: string | null;
  donorAreaConcernStatus: string | null;
  donorLimitationStatus: string | null;
  previousDonorProcedureEvidenceStatus: string | null;
  donorObservationSummary: string | null;
  activeScalpSymptomConcern: string | null;
  visibleScalpConditionConcern: string | null;
  unresolvedMedicalWarningStatus: string | null;
  additionalInformationRequiredStatus: string | null;
  warningCodes: string[];
  safetyObservationSummary: string | null;
}

export async function savePreliminaryAssessment(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  payload: SavePreliminaryAssessmentPayload,
) {
  const result = await transaction.query<{
    assessment_id: string;
    outcome_code: string;
    revision: number;
    version_id: string;
    review_state: string;
    material_change: boolean;
  }>(
    `select * from graftvision_private.save_preliminary_assessment(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid, $6::uuid, $7::uuid, $8::integer,
      $9::text, $10::text, $11::text, $12::text, $13::text, $14::text, $15::text, $16::text,
      $17::text, $18::text, $19::text, $20::text, $21::text, $22::text, $23::text, $24::text,
      $25::text, $26::text, $27::text[], $28::text
    )`,
    [
      sessionId,
      actorId,
      payload.consultationId,
      payload.expectedRevision,
      payload.idempotencyKey,
      payload.patientMedicalHistoryVersionId,
      payload.consultationHairLossHistoryVersionId,
      payload.consultationRevision,
      payload.patternClassification,
      payload.certaintyCode,
      payload.sourceCode,
      payload.limitedClarification,
      payload.frontalInvolvementStatus,
      payload.temporalInvolvementStatus,
      payload.midScalpInvolvementStatus,
      payload.crownInvolvementStatus,
      payload.diffuseInvolvementStatus,
      payload.recipientObservationSummary,
      payload.donorAreaConcernStatus,
      payload.donorLimitationStatus,
      payload.previousDonorProcedureEvidenceStatus,
      payload.donorObservationSummary,
      payload.activeScalpSymptomConcern,
      payload.visibleScalpConditionConcern,
      payload.unresolvedMedicalWarningStatus,
      payload.additionalInformationRequiredStatus,
      payload.warningCodes,
      payload.safetyObservationSummary,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Preliminary assessment save failed.");
  return {
    assessmentId: row.assessment_id,
    outcome: row.outcome_code === "success" ? "success" : "stale-revision",
    revision: row.revision,
    versionId: row.version_id,
    reviewState: row.review_state as PreliminaryAssessmentReviewState,
    materialChange: row.material_change,
  };
}

export async function transitionPreliminaryAssessmentReview(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  consultationId: string,
  expectedRevision: number,
  idempotencyKey: string,
  newState: PreliminaryAssessmentReviewState,
  controlledReason: string | null = null,
) {
  const result = await transaction.query<{
    outcome_code: string;
    review_state: string;
    revision: number;
  }>(
    `select * from graftvision_private.transition_preliminary_assessment_review(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::uuid, $6::text, $7::text
    )`,
    [
      sessionId,
      actorId,
      consultationId,
      expectedRevision,
      idempotencyKey,
      newState,
      controlledReason,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Preliminary assessment review transition failed.");
  return {
    outcome: row.outcome_code === "success" ? "success" : "stale-revision",
    reviewState: row.review_state as PreliminaryAssessmentReviewState,
    revision: row.revision,
  };
}

export async function readPreliminaryAssessment(
  transaction: TenantTransaction,
  sessionId: string,
  actorId: string,
  consultationId: string,
) {
  const result = await transaction.query<{
    assessment_id: string;
    version_id: string;
    revision: number;
    review_state: string;
    patient_medical_history_version_id: string;
    consultation_hair_loss_history_version_id: string;
    consultation_revision: number;
    pattern_classification: string | null;
    certainty_code: string | null;
    source_code: string | null;
    limited_clarification: string | null;
    frontal_involvement_status: string | null;
    temporal_involvement_status: string | null;
    mid_scalp_involvement_status: string | null;
    crown_involvement_status: string | null;
    diffuse_involvement_status: string | null;
    recipient_observation_summary: string | null;
    donor_area_concern_status: string | null;
    donor_limitation_status: string | null;
    previous_donor_procedure_evidence_status: string | null;
    donor_observation_summary: string | null;
    active_scalp_symptom_concern: string | null;
    visible_scalp_condition_concern: string | null;
    unresolved_medical_warning_status: string | null;
    additional_information_required_status: string | null;
    warning_codes: string[];
    safety_observation_summary: string | null;
    downstream_stale: boolean;
  }>(
    "select * from graftvision_private.read_preliminary_assessment($1::uuid, $2::uuid, $3::uuid)",
    [sessionId, actorId, consultationId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    assessmentId: row.assessment_id,
    versionId: row.version_id,
    revision: row.revision,
    reviewState: row.review_state as PreliminaryAssessmentReviewState,
    patientMedicalHistoryVersionId: row.patient_medical_history_version_id,
    consultationHairLossHistoryVersionId: row.consultation_hair_loss_history_version_id,
    consultationRevision: row.consultation_revision,
    patternClassification: row.pattern_classification,
    certaintyCode: row.certainty_code,
    sourceCode: row.source_code,
    limitedClarification: row.limited_clarification,
    frontalInvolvementStatus: row.frontal_involvement_status,
    temporalInvolvementStatus: row.temporal_involvement_status,
    midScalpInvolvementStatus: row.mid_scalp_involvement_status,
    crownInvolvementStatus: row.crown_involvement_status,
    diffuseInvolvementStatus: row.diffuse_involvement_status,
    recipientObservationSummary: row.recipient_observation_summary,
    donorAreaConcernStatus: row.donor_area_concern_status,
    donorLimitationStatus: row.donor_limitation_status,
    previousDonorProcedureEvidenceStatus: row.previous_donor_procedure_evidence_status,
    donorObservationSummary: row.donor_observation_summary,
    activeScalpSymptomConcern: row.active_scalp_symptom_concern,
    visibleScalpConditionConcern: row.visible_scalp_condition_concern,
    unresolvedMedicalWarningStatus: row.unresolved_medical_warning_status,
    additionalInformationRequiredStatus: row.additional_information_required_status,
    warningCodes: row.warning_codes,
    safetyObservationSummary: row.safety_observation_summary,
    downstreamStale: row.downstream_stale,
  };
}
