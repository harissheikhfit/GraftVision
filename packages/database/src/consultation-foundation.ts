import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CONSULTATION_DRAFT_PERMISSION = "CONSULT-PERM-001" as const;
export const CONSULTATION_DOCTOR_ASSIGNMENT_PERMISSION = "CONSULT-PERM-003" as const;
export const CONSULTATION_STATUSES = [
  "draft",
  "in-progress",
  "capture-complete",
  "review-required",
  "completed",
  "cancelled",
] as const;
export const CONSULTATION_ASSIGNMENT_REASON_CODES = [
  "INITIAL_ASSIGNMENT",
  "CASELOAD_REBALANCE",
  "DOCTOR_UNAVAILABLE",
  "CLINIC_ADMINISTRATIVE_CHANGE",
] as const;
export const CONSULTATION_STATUS_REASON_CODES = [
  "PREPARATION_STARTED",
  "PREPARATION_RESUMED",
  "CONSULTATION_CANCELLED",
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];
export type ConsultationAssignmentReasonCode =
  (typeof CONSULTATION_ASSIGNMENT_REASON_CODES)[number];
export type ConsultationStatusReasonCode = (typeof CONSULTATION_STATUS_REASON_CODES)[number];

export interface ConsultationContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ConsultationProjection {
  readonly assignedDoctorPlatformUserId: string | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly patientId: string;
  readonly revision: number;
  readonly status: ConsultationStatus;
  readonly updatedAt: Date;
}

export interface ConsultationAssignmentProjection {
  readonly consultationId: string;
  readonly doctorPlatformUserId: string;
  readonly revision: number;
}

export const CONSULTATION_CONFLICT_CHANGED_FIELDS = [
  "assigned_doctor",
  "consultation_revision",
  "status",
] as const;
export type ConsultationConflictChangedField =
  (typeof CONSULTATION_CONFLICT_CHANGED_FIELDS)[number];
export type ConsultationOperationCode = "doctor_assignment" | "status_transition";

export interface ConsultationConflictProjection {
  readonly changedFields: readonly ConsultationConflictChangedField[];
  readonly currentRevision: number;
  readonly currentStatus: ConsultationStatus;
  readonly operationCode: ConsultationOperationCode;
  readonly updatedAt: Date;
}

export type ConsultationMutationResult<T> =
  | { readonly outcome: "stale_revision"; readonly conflict: ConsultationConflictProjection }
  | { readonly outcome: "success"; readonly value: T };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} is invalid.`);
  }
}

function assertContext(context: ConsultationContext): void {
  assertUuid(context.applicationSessionId, "applicationSessionId");
  assertUuid(context.providerIdentityId, "providerIdentityId");
}

function toDatabaseStatus(status: ConsultationStatus): string {
  return status.replaceAll("-", "_");
}

function fromDatabaseStatus(status: string): ConsultationStatus {
  const productStatus = status.replaceAll("_", "-") as ConsultationStatus;
  if (!CONSULTATION_STATUSES.includes(productStatus)) {
    throw new DatabaseBoundaryError("Consultation status is invalid.");
  }
  return productStatus;
}

function mapConsultation(row: {
  readonly assigned_doctor_platform_user_id: string | null;
  readonly created_at: Date;
  readonly id: string;
  readonly patient_id: string;
  readonly revision: number;
  readonly status: string;
  readonly updated_at: Date;
}): ConsultationProjection {
  return {
    assignedDoctorPlatformUserId: row.assigned_doctor_platform_user_id,
    createdAt: row.created_at,
    id: row.id,
    patientId: row.patient_id,
    revision: row.revision,
    status: fromDatabaseStatus(row.status),
    updatedAt: row.updated_at,
  };
}

export async function createConsultation(
  transaction: TenantTransaction,
  input: ConsultationContext & {
    readonly idempotencyKey: string;
    readonly patientId: string;
  },
): Promise<ConsultationProjection> {
  assertContext(input);
  assertUuid(input.idempotencyKey, "idempotencyKey");
  assertUuid(input.patientId, "patientId");
  const result = await transaction.query<{
    readonly assigned_doctor_platform_user_id: string | null;
    readonly created_at: Date;
    readonly id: string;
    readonly patient_id: string;
    readonly revision: number;
    readonly status: string;
    readonly updated_at: Date;
  }>("select * from graftvision_private.create_consultation($1::uuid,$2::uuid,$3::uuid,$4::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.patientId,
    input.idempotencyKey,
  ]);
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Consultation creation failed.");
  return mapConsultation(row);
}

export async function readConsultation(
  transaction: TenantTransaction,
  input: ConsultationContext & { readonly consultationId: string },
): Promise<ConsultationProjection | null> {
  assertContext(input);
  assertUuid(input.consultationId, "consultationId");
  const result = await transaction.query<{
    readonly assigned_doctor_platform_user_id: string | null;
    readonly created_at: Date;
    readonly id: string;
    readonly patient_id: string;
    readonly revision: number;
    readonly status: string;
    readonly updated_at: Date;
  }>("select * from graftvision_private.read_consultation($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.consultationId,
  ]);
  return result.rows[0] ? mapConsultation(result.rows[0]) : null;
}

export async function listConsultations(
  transaction: TenantTransaction,
  input: ConsultationContext & { readonly patientId?: string },
): Promise<readonly ConsultationProjection[]> {
  assertContext(input);
  if (input.patientId !== undefined) assertUuid(input.patientId, "patientId");
  const result = await transaction.query<{
    readonly assigned_doctor_platform_user_id: string | null;
    readonly created_at: Date;
    readonly id: string;
    readonly patient_id: string;
    readonly revision: number;
    readonly status: string;
    readonly updated_at: Date;
  }>("select * from graftvision_private.list_consultations($1::uuid,$2::uuid,$3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.patientId ?? null,
  ]);
  return result.rows.map(mapConsultation);
}

export async function assignConsultationDoctor(
  transaction: TenantTransaction,
  input: ConsultationContext & {
    readonly consultationId: string;
    readonly doctorPlatformUserId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly reasonCode: ConsultationAssignmentReasonCode;
  },
): Promise<ConsultationMutationResult<ConsultationAssignmentProjection>> {
  assertContext(input);
  assertUuid(input.consultationId, "consultationId");
  assertUuid(input.doctorPlatformUserId, "doctorPlatformUserId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  if (!CONSULTATION_ASSIGNMENT_REASON_CODES.includes(input.reasonCode)) {
    throw new DatabaseBoundaryError("reasonCode is invalid.");
  }
  const result = await transaction.query<{
    readonly changed_fields: string[];
    readonly consultation_id: string;
    readonly doctor_platform_user_id: string | null;
    readonly operation_code: string;
    readonly outcome_code: string;
    readonly revision: number;
    readonly status: string;
    readonly updated_at: Date;
  }>(
    `select * from graftvision_private.assign_consultation_doctor_with_concurrency(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::integer,$6::text,$7::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.doctorPlatformUserId,
      input.expectedRevision,
      input.reasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Consultation Doctor assignment failed.");
  if (row.outcome_code === "stale_revision") {
    return { conflict: mapConflict(row), outcome: "stale_revision" };
  }
  if (row.outcome_code !== "success" || !row.doctor_platform_user_id) {
    throw new DatabaseBoundaryError("Consultation Doctor assignment result is invalid.");
  }
  return {
    outcome: "success",
    value: {
      consultationId: row.consultation_id,
      doctorPlatformUserId: row.doctor_platform_user_id,
      revision: row.revision,
    },
  };
}

export async function transitionConsultationStatus(
  transaction: TenantTransaction,
  input: ConsultationContext & {
    readonly consultationId: string;
    readonly expectedRevision: number;
    readonly idempotencyKey: string;
    readonly newStatus: "cancelled" | "in-progress";
    readonly reasonCode: ConsultationStatusReasonCode;
  },
): Promise<ConsultationMutationResult<Pick<ConsultationProjection, "id" | "revision" | "status">>> {
  assertContext(input);
  assertUuid(input.consultationId, "consultationId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  if (!CONSULTATION_STATUS_REASON_CODES.includes(input.reasonCode)) {
    throw new DatabaseBoundaryError("reasonCode is invalid.");
  }
  const result = await transaction.query<{
    readonly changed_fields: string[];
    readonly consultation_id: string;
    readonly operation_code: string;
    readonly outcome_code: string;
    readonly revision: number;
    readonly status: string;
    readonly updated_at: Date;
  }>(
    `select * from graftvision_private.transition_consultation_status_with_concurrency(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::text,$6::text,$7::uuid
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.consultationId,
      input.expectedRevision,
      toDatabaseStatus(input.newStatus),
      input.reasonCode,
      input.idempotencyKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Consultation status transition failed.");
  if (row.outcome_code === "stale_revision") {
    return { conflict: mapConflict(row), outcome: "stale_revision" };
  }
  if (row.outcome_code !== "success") {
    throw new DatabaseBoundaryError("Consultation status transition result is invalid.");
  }
  return {
    outcome: "success",
    value: {
      id: row.consultation_id,
      revision: row.revision,
      status: fromDatabaseStatus(row.status),
    },
  };
}

function mapConflict(row: {
  readonly changed_fields: readonly string[];
  readonly operation_code: string;
  readonly revision: number;
  readonly status: string;
  readonly updated_at: Date;
}): ConsultationConflictProjection {
  if (
    (row.operation_code !== "doctor_assignment" && row.operation_code !== "status_transition") ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    !Array.isArray(row.changed_fields) ||
    row.changed_fields.some(
      (field) =>
        !CONSULTATION_CONFLICT_CHANGED_FIELDS.includes(field as ConsultationConflictChangedField),
    )
  ) {
    throw new DatabaseBoundaryError("Consultation conflict result is invalid.");
  }
  return {
    changedFields: row.changed_fields as readonly ConsultationConflictChangedField[],
    currentRevision: row.revision,
    currentStatus: fromDatabaseStatus(row.status),
    operationCode: row.operation_code,
    updatedAt: row.updated_at,
  };
}
