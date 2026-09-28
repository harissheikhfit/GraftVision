import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_CONSENT_PERMISSION = "PATIENT-PERM-001" as const;
export const PRIVACY_PURPOSE_CODE = "REGISTRATION_PRIVACY" as const;
export const PRIVACY_NOTICE_LANGUAGES = ["en", "ur"] as const;
export const PRIVACY_ACKNOWLEDGEMENT_STATUSES = [
  "pending",
  "acknowledged",
  "withdrawn",
  "superseded",
] as const;

export type PrivacyNoticeLanguage = (typeof PRIVACY_NOTICE_LANGUAGES)[number];
export type PrivacyAcknowledgementStatus = (typeof PRIVACY_ACKNOWLEDGEMENT_STATUSES)[number];

export interface PrivacyNoticeProjection {
  readonly contentReference: string;
  readonly effectiveDate: string;
  readonly language: PrivacyNoticeLanguage;
  readonly noticePairId: string;
  readonly noticeVersionId: string;
  readonly purposeCode: typeof PRIVACY_PURPOSE_CODE;
  readonly semanticVersion: string;
  readonly state: "approved" | "superseded";
}

export interface PrivacyAcknowledgementProjection {
  readonly id: string;
  readonly languagePresented: PrivacyNoticeLanguage;
  readonly noticeVersionId: string;
  readonly occurredAt: string;
  readonly purposeCode: typeof PRIVACY_PURPOSE_CODE;
  readonly revision: number;
  readonly status: PrivacyAcknowledgementStatus;
  readonly withdrawalAt: string | null;
}

export interface PatientPrivacyAcknowledgementView {
  readonly current: PrivacyAcknowledgementProjection | null;
  readonly notices: readonly PrivacyNoticeProjection[];
}

export interface PrivacyAcknowledgementResult {
  readonly id: string;
  readonly noticeVersionId: string;
  readonly revision: number;
  readonly status: PrivacyAcknowledgementStatus;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) throw new DatabaseBoundaryError(`${field} is invalid.`);
}

export async function readPatientPrivacyAcknowledgement(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
  },
): Promise<PatientPrivacyAcknowledgementView | null> {
  assertUuid(input.applicationSessionId, "applicationSessionId");
  assertUuid(input.patientId, "patientId");
  assertUuid(input.providerIdentityId, "providerIdentityId");
  const result = await transaction.query<{
    readonly result: PatientPrivacyAcknowledgementView | null;
  }>(
    `select graftvision_private.read_patient_privacy_acknowledgement(
      $1::uuid, $2::uuid, $3::uuid
    ) as result`,
    [input.applicationSessionId, input.providerIdentityId, input.patientId],
  );
  return result.rows[0]?.result ?? null;
}

export async function recordPatientPrivacyAcknowledgement(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly channel: "IN_PERSON_CLINIC" | "REMOTE_VERIFIED";
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly language: PrivacyNoticeLanguage;
    readonly noticeVersionId: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
  },
): Promise<PrivacyAcknowledgementResult> {
  for (const [field, value] of Object.entries({
    applicationSessionId: input.applicationSessionId,
    idempotencyKey: input.idempotencyKey,
    noticeVersionId: input.noticeVersionId,
    patientId: input.patientId,
    providerIdentityId: input.providerIdentityId,
  })) {
    assertUuid(value, field);
  }
  if (!PRIVACY_NOTICE_LANGUAGES.includes(input.language) || input.expectedRevision < 0) {
    throw new DatabaseBoundaryError("Privacy acknowledgement input is invalid.");
  }
  const result = await transaction.query<{ readonly result: PrivacyAcknowledgementResult }>(
    `select graftvision_private.record_patient_privacy_acknowledgement(
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text,
      $7::uuid, $8::integer, null, null
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.patientId,
      input.noticeVersionId,
      input.language,
      input.channel,
      input.idempotencyKey,
      input.expectedRevision,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Privacy acknowledgement returned no result.");
  return row.result;
}

export async function withdrawPatientPrivacyAcknowledgement(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
  },
): Promise<PrivacyAcknowledgementResult> {
  for (const [field, value] of Object.entries({
    applicationSessionId: input.applicationSessionId,
    idempotencyKey: input.idempotencyKey,
    patientId: input.patientId,
    providerIdentityId: input.providerIdentityId,
  })) {
    assertUuid(value, field);
  }
  const result = await transaction.query<{ readonly result: PrivacyAcknowledgementResult }>(
    `select graftvision_private.withdraw_patient_privacy_acknowledgement(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, 'PATIENT_REQUEST',
      $5::uuid, null, null
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.patientId,
      input.expectedRevision,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Privacy withdrawal returned no result.");
  return row.result;
}
