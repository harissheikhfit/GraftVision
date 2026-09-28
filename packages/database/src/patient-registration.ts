import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_REGISTRATION_PERMISSION = "PATIENT-PERM-001" as const;
export const PATIENT_REGISTRATION_PROVENANCE = "REGISTRATION_FORM" as const;
export const PATIENT_DUPLICATE_OVERRIDE_REASONS = [
  "CONFIRMED_DISTINCT_PERSON",
  "KNOWN_SEPARATE_RECORD",
] as const;
export const PATIENT_DUPLICATE_MATCH_REASONS = [
  "PHONE_EXACT",
  "EMAIL_EXACT",
  "NAME_DOB_EXACT",
] as const;

export type PatientDuplicateOverrideReason = (typeof PATIENT_DUPLICATE_OVERRIDE_REASONS)[number];
export type PatientDuplicateMatchReason = (typeof PATIENT_DUPLICATE_MATCH_REASONS)[number];

export interface PatientRegistrationContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface MaskedDuplicatePatient {
  readonly birthYear: number;
  readonly hasEmail: boolean;
  readonly hasPhone: boolean;
  readonly maskedName: string;
  readonly maskedPatientNumber: string;
  readonly matchReasonCodes: readonly PatientDuplicateMatchReason[];
  readonly patientReference: string;
}

export interface RegisteredPatientProjection {
  readonly createdAt: Date;
  readonly id: string;
  readonly patientNumber: string;
  readonly revision: number;
  readonly status: "active";
  readonly updatedAt: Date;
}

export type PatientRegistrationResult =
  | {
      readonly duplicates: readonly MaskedDuplicatePatient[];
      readonly outcome: "duplicate_warning";
    }
  | { readonly outcome: "created"; readonly patient: RegisteredPatientProjection };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const phonePattern = /^\+[1-9][0-9]{7,14}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) throw new DatabaseBoundaryError(`${name} is invalid.`);
}

export function validatePatientRegistration(input: {
  readonly dateOfBirth: string;
  readonly email?: string;
  readonly fullName: string;
  readonly phone: string;
}): void {
  const name = input.fullName.trim().replaceAll(/\s+/gu, " ");
  const phone = input.phone.replaceAll(/[\s().-]+/gu, "");
  const email = input.email?.trim().toLowerCase();
  if (name.length < 2 || name.length > 160) {
    throw new DatabaseBoundaryError("fullName is invalid.");
  }
  const parsedDate = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (
    !datePattern.test(input.dateOfBirth) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== input.dateOfBirth ||
    input.dateOfBirth < "1900-01-01" ||
    input.dateOfBirth > today
  ) {
    throw new DatabaseBoundaryError("dateOfBirth is invalid.");
  }
  if (!phonePattern.test(phone)) throw new DatabaseBoundaryError("phone is invalid.");
  if (email && (email.length > 254 || !emailPattern.test(email))) {
    throw new DatabaseBoundaryError("email is invalid.");
  }
}

export async function registerPatient(
  transaction: TenantTransaction,
  input: PatientRegistrationContext & {
    readonly dateOfBirth: string;
    readonly email?: string;
    readonly fullName: string;
    readonly idempotencyKey: string;
    readonly overrideReasonCode?: PatientDuplicateOverrideReason;
    readonly phone: string;
  },
): Promise<PatientRegistrationResult> {
  assertUuid(input.applicationSessionId, "applicationSessionId");
  assertUuid(input.providerIdentityId, "providerIdentityId");
  assertUuid(input.idempotencyKey, "idempotencyKey");
  validatePatientRegistration(input);
  if (
    input.overrideReasonCode &&
    !PATIENT_DUPLICATE_OVERRIDE_REASONS.includes(input.overrideReasonCode)
  ) {
    throw new DatabaseBoundaryError("overrideReasonCode is invalid.");
  }
  const result = await transaction.query<{
    readonly created_at: Date | null;
    readonly duplicates: MaskedDuplicatePatient[];
    readonly id: string | null;
    readonly outcome: "created" | "duplicate_warning";
    readonly patient_number: string | null;
    readonly revision: number | null;
    readonly status: "active" | null;
    readonly updated_at: Date | null;
  }>(
    `select * from graftvision_private.register_patient(
      $1::uuid, $2::uuid, $3::uuid, $4::text, $5::date, $6::text,
      $7::text, $8::text, $9::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.idempotencyKey,
      input.fullName,
      input.dateOfBirth,
      input.phone,
      input.email ?? null,
      PATIENT_REGISTRATION_PROVENANCE,
      input.overrideReasonCode ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Patient registration failed.");
  if (row.outcome === "duplicate_warning") {
    return { duplicates: row.duplicates, outcome: "duplicate_warning" };
  }
  if (
    !row.id ||
    !row.patient_number ||
    !row.status ||
    row.revision === null ||
    !row.created_at ||
    !row.updated_at
  ) {
    throw new DatabaseBoundaryError("Patient registration returned an invalid projection.");
  }
  return {
    outcome: "created",
    patient: {
      createdAt: row.created_at,
      id: row.id,
      patientNumber: row.patient_number,
      revision: row.revision,
      status: row.status,
      updatedAt: row.updated_at,
    },
  };
}
