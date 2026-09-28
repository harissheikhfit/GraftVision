import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_LIFECYCLE_PERMISSION = "PATIENT-PERM-001" as const;
export const PATIENT_LIFECYCLE_STATES = ["current", "archived"] as const;
export const PATIENT_ARCHIVE_REASON_CODES = [
  "duplicate_created_in_error",
  "patient_requested_inactive_record",
  "registered_in_error",
  "no_longer_receiving_services",
  "administrative_cleanup",
  "other_controlled",
] as const;
export const PATIENT_RESTORE_REASON_CODES = [
  "patient_returned",
  "archived_in_error",
  "record_review_completed",
  "administrative_restore",
] as const;

export type PatientLifecycleState = (typeof PATIENT_LIFECYCLE_STATES)[number];
export type PatientArchiveReasonCode = (typeof PATIENT_ARCHIVE_REASON_CODES)[number];
export type PatientRestoreReasonCode = (typeof PATIENT_RESTORE_REASON_CODES)[number];

export interface PatientLifecycleProjection {
  readonly lifecycleRevision: number;
  readonly lifecycleState: PatientLifecycleState;
  readonly patientId: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) throw new DatabaseBoundaryError(`${name} is invalid.`);
}

async function transitionPatientLifecycle(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
    readonly reasonCode: PatientArchiveReasonCode | PatientRestoreReasonCode;
    readonly targetState: PatientLifecycleState;
  },
): Promise<PatientLifecycleProjection> {
  assertUuid(input.applicationSessionId, "applicationSessionId");
  assertUuid(input.providerIdentityId, "providerIdentityId");
  assertUuid(input.patientId, "patientId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  const allowedReasons =
    input.targetState === "archived" ? PATIENT_ARCHIVE_REASON_CODES : PATIENT_RESTORE_REASON_CODES;
  if (!(allowedReasons as readonly string[]).includes(input.reasonCode)) {
    throw new DatabaseBoundaryError("reasonCode is invalid.");
  }
  const result = await transaction.query<{
    readonly lifecycle_revision: number;
    readonly lifecycle_state: PatientLifecycleState;
    readonly patient_id: string;
  }>(
    `select * from graftvision_private.transition_patient_lifecycle(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::text, $6::text, $7::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.patientId,
      input.expectedRevision,
      input.targetState,
      input.reasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Patient lifecycle transition failed.");
  return {
    lifecycleRevision: row.lifecycle_revision,
    lifecycleState: row.lifecycle_state,
    patientId: row.patient_id,
  };
}

export function archivePatient(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
    readonly reasonCode: PatientArchiveReasonCode;
  },
): Promise<PatientLifecycleProjection> {
  return transitionPatientLifecycle(transaction, { ...input, targetState: "archived" });
}

export function restorePatient(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly patientId: string;
    readonly providerIdentityId: string;
    readonly reasonCode: PatientRestoreReasonCode;
  },
): Promise<PatientLifecycleProjection> {
  return transitionPatientLifecycle(transaction, { ...input, targetState: "current" });
}
