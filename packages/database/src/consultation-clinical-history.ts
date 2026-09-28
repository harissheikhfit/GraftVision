import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CLINICAL_REVIEW_STATES = [
  "draft",
  "submitted-for-review",
  "Doctor-reviewed",
  "amendment-required",
  "superseded",
  "retracted",
] as const;
export const CLINICAL_SOURCE_CODES = [
  "patient-reported",
  "caregiver-reported",
  "prior-record",
  "clinician-observed",
  "clinician-measured",
  "device-generated",
  "imported",
  "system-suggested",
  "unknown",
] as const;
export const CLINICAL_CERTAINTY_CODES = [
  "reported",
  "observed",
  "measured",
  "documented",
  "verified",
  "uncertain",
  "not-assessed",
  "contradicted",
] as const;
export const MEDICAL_CONDITION_STATUSES = [
  "no-known-significant-condition",
  "condition-reported",
  "uncertain",
  "not-assessed",
] as const;
export const REPORTED_STATUSES = [
  "none-reported",
  "reported",
  "uncertain",
  "not-assessed",
] as const;
export const HAIR_LOSS_CONCERNS = [
  "frontal-recession",
  "temporal-recession",
  "frontal-thinning",
  "mid-scalp-thinning",
  "crown-thinning",
  "diffuse-thinning",
  "patchy-loss",
  "donor-area-thinning",
  "hairline-shape-concern",
  "previous-transplant-concern",
  "other",
  "uncertain",
] as const;

export type ClinicalReviewState = (typeof CLINICAL_REVIEW_STATES)[number];
export type ClinicalSourceCode = (typeof CLINICAL_SOURCE_CODES)[number];
export type ClinicalCertaintyCode = (typeof CLINICAL_CERTAINTY_CODES)[number];

export interface ClinicalContext {
  readonly applicationSessionId: string;
  readonly consultationId: string;
  readonly providerIdentityId: string;
}

export interface ClinicalHistorySummary {
  readonly doctorFinalisationReady: boolean;
  readonly downstreamStale: boolean;
  readonly hairHistoryId: string;
  readonly hairReviewState: ClinicalReviewState;
  readonly hairRevision: number;
  readonly hairVersionId: string;
  readonly medicalHistoryId: string;
  readonly medicalReviewState: ClinicalReviewState;
  readonly medicalRevision: number;
  readonly medicalVersionId: string;
  readonly preliminaryReady: boolean;
}

export interface ClinicalMutationResult {
  readonly changedFields: readonly string[];
  readonly historyId: string | null;
  readonly materialChange: boolean;
  readonly outcome: "stale-revision" | "success";
  readonly reviewState: ClinicalReviewState;
  readonly revision: number;
  readonly versionId: string | null;
}

export interface MedicalHistoryInput {
  readonly allergyStatus: "allergy-reported" | "none-reported" | "not-assessed" | "uncertain";
  readonly allergySubstance?: string | undefined;
  readonly anaesthesiaIssueStatus:
    "issue-reported" | "none-reported" | "not-assessed" | "uncertain";
  readonly bleedingConcernStatus:
    "concern-reported" | "none-reported" | "not-assessed" | "uncertain";
  readonly certaintyCode: ClinicalCertaintyCode;
  readonly expectedRevision: number;
  readonly healingConcernStatus:
    "concern-reported" | "none-reported" | "not-assessed" | "uncertain";
  readonly idempotencyKey: string;
  readonly medicalConditionClarification?: string | undefined;
  readonly medicalConditionStatus: (typeof MEDICAL_CONDITION_STATUSES)[number];
  readonly medicationName?: string | undefined;
  readonly medicationStatus: "medication-reported" | "none-reported" | "not-assessed" | "uncertain";
  readonly previousOperationStatus:
    "none-reported" | "not-assessed" | "procedure-reported" | "uncertain";
  readonly sectionSummary?: string | undefined;
  readonly sourceCode: ClinicalSourceCode;
  readonly warningCodes: readonly string[];
}

export interface HairLossHistoryInput {
  readonly certaintyCode: ClinicalCertaintyCode;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly onsetKind: "age" | "uncertain" | "year";
  readonly onsetValue?: number | undefined;
  readonly patientGoalCodes: readonly string[];
  readonly patternClassification:
    | "christmas-tree"
    | "hamilton-norwood"
    | "ludwig"
    | "other-clinician-defined"
    | "unclassified"
    | "uncertain";
  readonly previousHairProcedureStatus:
    "none-reported" | "not-assessed" | "procedure-reported" | "uncertain";
  readonly primaryConcern: (typeof HAIR_LOSS_CONCERNS)[number];
  readonly progression:
    | "episodic"
    | "improved"
    | "not-assessed"
    | "rapidly-progressive"
    | "slowly-progressive"
    | "stable"
    | "uncertain";
  readonly scalpSymptomCodes: readonly string[];
  readonly scalpSymptomStatus: "none-reported" | "not-assessed" | "symptoms-reported" | "uncertain";
  readonly sectionClarification?: string | undefined;
  readonly sourceCode: ClinicalSourceCode;
}

export type MedicalHistoryProjection = Omit<
  MedicalHistoryInput,
  "expectedRevision" | "idempotencyKey"
> & {
  readonly historyId: string;
  readonly reviewState: ClinicalReviewState;
  readonly revision: number;
  readonly versionId: string;
};
export type HairLossHistoryProjection = Omit<
  HairLossHistoryInput,
  "expectedRevision" | "idempotencyKey"
> & {
  readonly historyId: string;
  readonly reviewState: ClinicalReviewState;
  readonly revision: number;
  readonly versionId: string;
};
export interface DoctorPrivateNoteProjection {
  readonly authorPlatformUserId: string;
  readonly noteId: string;
  readonly noteText: string;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly versionId: string;
}

type MedicalHistoryRow = {
  allergy_status: string;
  allergy_substance: string | null;
  anaesthesia_issue_status: string;
  bleeding_concern_status: string;
  certainty_code: string;
  healing_concern_status: string;
  history_id: string;
  medical_condition_clarification: string | null;
  medical_condition_status: string;
  medication_name: string | null;
  medication_status: string;
  previous_operation_status: string;
  review_state: string;
  revision: number;
  section_summary: string | null;
  source_code: string;
  version_id: string;
  warning_codes: string[];
};

type HairLossHistoryRow = {
  certainty_code: string;
  history_id: string;
  onset_kind: "age" | "uncertain" | "year";
  onset_value: number | null;
  patient_goal_codes: string[];
  pattern_classification: string;
  previous_hair_procedure_status: string;
  primary_concern: string;
  progression: string;
  review_state: string;
  revision: number;
  scalp_symptom_codes: string[];
  scalp_symptom_status: string;
  section_clarification: string | null;
  source_code: string;
  version_id: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const toDb = (value: string): string => value.replaceAll("-", "_").replace("Doctor", "doctor");
const fromDb = <Value extends string>(value: string): Value => value.replaceAll("_", "-") as Value;
const fromDbState = (value: string): ClinicalReviewState =>
  value === "doctor_reviewed"
    ? "Doctor-reviewed"
    : (value.replaceAll("_", "-") as ClinicalReviewState);

function assertContext(input: ClinicalContext): void {
  for (const value of [
    input.applicationSessionId,
    input.consultationId,
    input.providerIdentityId,
  ]) {
    if (!uuidPattern.test(value)) throw new DatabaseBoundaryError("Clinical context is invalid.");
  }
}
function assertMutation(revision: number, key: string): void {
  if (!Number.isSafeInteger(revision) || revision < 0 || !uuidPattern.test(key)) {
    throw new DatabaseBoundaryError("Clinical mutation context is invalid.");
  }
}
function optionalText(value: string | undefined, maximum: number): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw new DatabaseBoundaryError("Clinical text is too long.");
  return normalized;
}

function mapMutation(row: {
  changed_fields: string[];
  history_id: string | null;
  material_change: boolean;
  outcome_code: string;
  review_state: string;
  revision: number;
  version_id: string | null;
}): ClinicalMutationResult {
  return {
    changedFields: row.changed_fields,
    historyId: row.history_id,
    materialChange: row.material_change,
    outcome: row.outcome_code === "success" ? "success" : "stale-revision",
    reviewState: fromDbState(row.review_state),
    revision: row.revision,
    versionId: row.version_id,
  };
}

export async function saveMedicalHistory(
  transaction: TenantTransaction,
  input: ClinicalContext & MedicalHistoryInput,
): Promise<ClinicalMutationResult> {
  assertContext(input);
  assertMutation(input.expectedRevision, input.idempotencyKey);
  const allergy = optionalText(input.allergySubstance, 500);
  const medication = optionalText(input.medicationName, 500);
  if ((input.allergyStatus === "allergy-reported") !== Boolean(allergy)) {
    throw new DatabaseBoundaryError("Reported allergy detail is required.");
  }
  if ((input.medicationStatus === "medication-reported") !== Boolean(medication)) {
    throw new DatabaseBoundaryError("Reported medication detail is required.");
  }
  const result = await transaction.query<Parameters<typeof mapMutation>[0]>(
    `select * from graftvision_private.save_patient_medical_history(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text,$7::text,$8::text,
      $9::text,$10::text,$11::text,$12::text,$13::text,$14::text,$15::text,
      $16::text,$17::text,$18::text[],$19::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.expectedRevision,
      input.idempotencyKey,
      toDb(input.medicalConditionStatus),
      optionalText(input.medicalConditionClarification, 500),
      toDb(input.allergyStatus),
      allergy,
      toDb(input.medicationStatus),
      medication,
      toDb(input.previousOperationStatus),
      toDb(input.anaesthesiaIssueStatus),
      toDb(input.bleedingConcernStatus),
      toDb(input.healingConcernStatus),
      toDb(input.sourceCode),
      toDb(input.certaintyCode),
      input.warningCodes,
      optionalText(input.sectionSummary, 1500),
    ],
  );
  if (!result.rows[0]) throw new DatabaseBoundaryError("Medical history save failed.");
  return mapMutation(result.rows[0]);
}

export async function saveHairLossHistory(
  transaction: TenantTransaction,
  input: ClinicalContext & HairLossHistoryInput,
): Promise<ClinicalMutationResult> {
  assertContext(input);
  assertMutation(input.expectedRevision, input.idempotencyKey);
  if (
    (input.onsetKind === "uncertain" && input.onsetValue !== undefined) ||
    (input.onsetKind !== "uncertain" && !Number.isSafeInteger(input.onsetValue))
  ) {
    throw new DatabaseBoundaryError("Hair-loss onset is invalid.");
  }
  const result = await transaction.query<Parameters<typeof mapMutation>[0]>(
    `select * from graftvision_private.save_consultation_hair_loss_history(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text,$7::text,$8::integer,
      $9::text,$10::text,$11::text,$12::text,$13::text[],$14::text[],$15::text,
      $16::text,$17::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.expectedRevision,
      input.idempotencyKey,
      toDb(input.primaryConcern),
      input.onsetKind,
      input.onsetValue ?? null,
      toDb(input.progression),
      toDb(input.previousHairProcedureStatus),
      toDb(input.patternClassification),
      toDb(input.scalpSymptomStatus),
      input.scalpSymptomCodes.map(toDb),
      input.patientGoalCodes.map(toDb),
      toDb(input.sourceCode),
      toDb(input.certaintyCode),
      optionalText(input.sectionClarification, 1500),
    ],
  );
  if (!result.rows[0]) throw new DatabaseBoundaryError("Hair-loss history save failed.");
  return mapMutation(result.rows[0]);
}

export async function readClinicalHistorySummary(
  transaction: TenantTransaction,
  input: ClinicalContext,
): Promise<ClinicalHistorySummary | null> {
  assertContext(input);
  const result = await transaction.query<{
    doctor_finalisation_ready: boolean;
    downstream_stale: boolean;
    hair_history_id: string;
    hair_review_state: string;
    hair_revision: number;
    hair_version_id: string;
    medical_history_id: string;
    medical_review_state: string;
    medical_revision: number;
    medical_version_id: string;
    preliminary_ready: boolean;
  }>(
    "select * from graftvision_private.read_consultation_clinical_history($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.consultationId],
  );
  const row = result.rows[0];
  return row
    ? {
        doctorFinalisationReady: row.doctor_finalisation_ready,
        downstreamStale: row.downstream_stale,
        hairHistoryId: row.hair_history_id,
        hairReviewState: fromDbState(row.hair_review_state),
        hairRevision: row.hair_revision,
        hairVersionId: row.hair_version_id,
        medicalHistoryId: row.medical_history_id,
        medicalReviewState: fromDbState(row.medical_review_state),
        medicalRevision: row.medical_revision,
        medicalVersionId: row.medical_version_id,
        preliminaryReady: row.preliminary_ready,
      }
    : null;
}

export async function readMedicalHistory(
  transaction: TenantTransaction,
  input: ClinicalContext,
): Promise<MedicalHistoryProjection | null> {
  assertContext(input);
  const result = await transaction.query<MedicalHistoryRow>(
    "select * from graftvision_private.read_current_medical_history($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.consultationId],
  );
  const row = result.rows[0];
  return row
    ? {
        allergyStatus: fromDb(row.allergy_status),
        allergySubstance: row.allergy_substance ?? undefined,
        anaesthesiaIssueStatus: fromDb(row.anaesthesia_issue_status),
        bleedingConcernStatus: fromDb(row.bleeding_concern_status),
        certaintyCode: fromDb(row.certainty_code),
        healingConcernStatus: fromDb(row.healing_concern_status),
        historyId: row.history_id,
        medicalConditionClarification: row.medical_condition_clarification ?? undefined,
        medicalConditionStatus: fromDb(row.medical_condition_status),
        medicationName: row.medication_name ?? undefined,
        medicationStatus: fromDb(row.medication_status),
        previousOperationStatus: fromDb(row.previous_operation_status),
        reviewState: fromDbState(row.review_state),
        revision: row.revision,
        sectionSummary: row.section_summary ?? undefined,
        sourceCode: fromDb(row.source_code),
        versionId: row.version_id,
        warningCodes: row.warning_codes,
      }
    : null;
}

export async function readHairLossHistory(
  transaction: TenantTransaction,
  input: ClinicalContext,
): Promise<HairLossHistoryProjection | null> {
  assertContext(input);
  const result = await transaction.query<HairLossHistoryRow>(
    "select * from graftvision_private.read_current_hair_loss_history($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.consultationId],
  );
  const row = result.rows[0];
  return row
    ? {
        certaintyCode: fromDb(row.certainty_code),
        historyId: row.history_id,
        onsetKind: row.onset_kind,
        onsetValue: row.onset_value ?? undefined,
        patientGoalCodes: row.patient_goal_codes.map((value: string) => value.replaceAll("_", "-")),
        patternClassification: fromDb(row.pattern_classification),
        previousHairProcedureStatus: fromDb(row.previous_hair_procedure_status),
        primaryConcern: fromDb(row.primary_concern),
        progression: fromDb(row.progression),
        reviewState: fromDbState(row.review_state),
        revision: row.revision,
        scalpSymptomCodes: row.scalp_symptom_codes.map((value: string) =>
          value.replaceAll("_", "-"),
        ),
        scalpSymptomStatus: fromDb(row.scalp_symptom_status),
        sectionClarification: row.section_clarification ?? undefined,
        sourceCode: fromDb(row.source_code),
        versionId: row.version_id,
      }
    : null;
}

export async function transitionClinicalHistoryReview(
  transaction: TenantTransaction,
  input: ClinicalContext & {
    aggregateType: "hair-loss-history" | "medical-history";
    expectedRevision: number;
    idempotencyKey: string;
    newState: "Doctor-reviewed" | "amendment-required" | "retracted" | "submitted-for-review";
    reasonCode: string;
  },
): Promise<{
  outcome: "stale-revision" | "success";
  reviewState: ClinicalReviewState;
  revision: number;
}> {
  assertContext(input);
  assertMutation(input.expectedRevision, input.idempotencyKey);
  const result = await transaction.query<{
    outcome_code: string;
    review_state: string;
    revision: number;
  }>(
    `select * from graftvision_private.transition_clinical_history_review(
      $1::uuid,$2::uuid,$3::uuid,$4::text,$5::integer,$6::text,$7::text,$8::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      toDb(input.aggregateType),
      input.expectedRevision,
      toDb(input.newState),
      input.reasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Clinical review transition failed.");
  return {
    outcome: row.outcome_code === "success" ? "success" : "stale-revision",
    reviewState: fromDbState(row.review_state),
    revision: row.revision,
  };
}

export async function mutateDoctorPrivateNote(
  transaction: TenantTransaction,
  input: ClinicalContext & {
    action: "amend" | "create" | "retract";
    expectedRevision: number;
    idempotencyKey: string;
    noteId?: string | undefined;
    noteText?: string | undefined;
    reasonCode?: string | undefined;
  },
): Promise<{
  noteId: string;
  outcome: "stale-revision" | "success";
  revision: number;
  status: string;
  versionId: string;
}> {
  assertContext(input);
  assertMutation(input.expectedRevision, input.idempotencyKey);
  if (input.noteId && !uuidPattern.test(input.noteId)) {
    throw new DatabaseBoundaryError("Private note identifier is invalid.");
  }
  const result = await transaction.query<{
    note_id: string;
    outcome_code: string;
    revision: number;
    status: string;
    version_id: string;
  }>(
    `select * from graftvision_private.mutate_doctor_private_note(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::integer,$6::text,$7::text,$8::text,$9::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.noteId ?? null,
      input.expectedRevision,
      input.action,
      optionalText(input.noteText, 3000),
      input.reasonCode ?? null,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Private note mutation failed.");
  return {
    noteId: row.note_id,
    outcome: row.outcome_code === "success" ? "success" : "stale-revision",
    revision: row.revision,
    status: row.status,
    versionId: row.version_id,
  };
}

export async function readActiveDoctorPrivateNotes(
  transaction: TenantTransaction,
  input: ClinicalContext,
): Promise<readonly DoctorPrivateNoteProjection[]> {
  assertContext(input);
  const result = await transaction.query<{
    author_platform_user_id: string;
    note_id: string;
    note_text: string;
    revision: number;
    updated_at: Date;
    version_id: string;
  }>(
    "select * from graftvision_private.read_active_doctor_private_notes($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.consultationId],
  );
  return result.rows.map((row) => ({
    authorPlatformUserId: row.author_platform_user_id,
    noteId: row.note_id,
    noteText: row.note_text,
    revision: row.revision,
    updatedAt: row.updated_at,
    versionId: row.version_id,
  }));
}
