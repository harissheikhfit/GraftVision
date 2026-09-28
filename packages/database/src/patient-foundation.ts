import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_ROOT_PERMISSION = "PATIENT-PERM-001" as const;
export const PATIENT_ROOT_STATUSES = ["active", "inactive"] as const;
export const PATIENT_PROVENANCE_CODES = ["MANUAL_REGISTRATION"] as const;

export type PatientRootStatus = (typeof PATIENT_ROOT_STATUSES)[number];
export type PatientProvenanceCode = (typeof PATIENT_PROVENANCE_CODES)[number];

export interface PatientRootContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface PatientRootProjection {
  readonly createdAt: Date;
  readonly id: string;
  readonly patientNumber: string;
  readonly revision: number;
  readonly status: PatientRootStatus;
  readonly updatedAt: Date;
}

export type PatientStatusChangeResult = "conflict" | "not_found" | "unchanged" | "updated";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} is invalid.`);
  }
}

function assertContext(context: PatientRootContext): void {
  assertUuid(context.applicationSessionId, "applicationSessionId");
  assertUuid(context.providerIdentityId, "providerIdentityId");
}

function mapProjection(row: {
  readonly created_at: Date;
  readonly id: string;
  readonly patient_number: string;
  readonly revision: number;
  readonly status: PatientRootStatus;
  readonly updated_at: Date;
}): PatientRootProjection {
  return {
    createdAt: row.created_at,
    id: row.id,
    patientNumber: row.patient_number,
    revision: row.revision,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function createPatientRoot(
  transaction: TenantTransaction,
  input: PatientRootContext & {
    readonly idempotencyKey: string;
    readonly provenanceCode: PatientProvenanceCode;
    readonly status: PatientRootStatus;
  },
): Promise<PatientRootProjection> {
  assertContext(input);
  assertUuid(input.idempotencyKey, "idempotencyKey");
  if (!PATIENT_ROOT_STATUSES.includes(input.status)) {
    throw new DatabaseBoundaryError("status is invalid.");
  }
  if (!PATIENT_PROVENANCE_CODES.includes(input.provenanceCode)) {
    throw new DatabaseBoundaryError("provenanceCode is invalid.");
  }
  const result = await transaction.query<{
    readonly created_at: Date;
    readonly id: string;
    readonly patient_number: string;
    readonly revision: number;
    readonly status: PatientRootStatus;
    readonly updated_at: Date;
  }>(
    `select * from graftvision_private.create_patient_root(
      $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.idempotencyKey,
      input.status,
      input.provenanceCode,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Patient creation failed.");
  return mapProjection(row);
}

export async function readPatientRoot(
  transaction: TenantTransaction,
  input: PatientRootContext & { readonly patientId: string },
): Promise<PatientRootProjection | null> {
  assertContext(input);
  assertUuid(input.patientId, "patientId");
  const result = await transaction.query<{
    readonly created_at: Date;
    readonly id: string;
    readonly patient_number: string;
    readonly revision: number;
    readonly status: PatientRootStatus;
    readonly updated_at: Date;
  }>("select * from graftvision_private.read_patient_root($1::uuid, $2::uuid, $3::uuid)", [
    input.applicationSessionId,
    input.providerIdentityId,
    input.patientId,
  ]);
  return result.rows[0] ? mapProjection(result.rows[0]) : null;
}

export async function changePatientStatus(
  transaction: TenantTransaction,
  input: PatientRootContext & {
    readonly expectedRevision: number;
    readonly patientId: string;
    readonly status: PatientRootStatus;
  },
): Promise<PatientStatusChangeResult> {
  assertContext(input);
  assertUuid(input.patientId, "patientId");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  if (!PATIENT_ROOT_STATUSES.includes(input.status)) {
    throw new DatabaseBoundaryError("status is invalid.");
  }
  const result = await transaction.query<{ readonly result: PatientStatusChangeResult }>(
    `select graftvision_private.change_patient_status(
      $1::uuid, $2::uuid, $3::uuid, $4::integer, $5::text
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.patientId,
      input.expectedRevision,
      input.status,
    ],
  );
  const outcome = result.rows[0]?.result;
  if (!outcome) throw new DatabaseBoundaryError("Patient status change failed.");
  return outcome;
}
