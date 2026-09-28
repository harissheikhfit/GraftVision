import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_PROFILE_PERMISSION = "PATIENT-PERM-001" as const;
export const PATIENT_TIMELINE_EVENT_CODES = [
  "PATIENT_CREATED",
  "REGISTRATION_CREATED",
  "DUPLICATE_OVERRIDE",
  "PATIENT_STATUS_CHANGED",
  "PATIENT_ARCHIVED",
  "PATIENT_RESTORED",
] as const;

export type PatientTimelineEventCode = (typeof PATIENT_TIMELINE_EVENT_CODES)[number];

export interface MaskedPatientProfile {
  readonly id: string;
  readonly maskedDateOfBirth: string;
  readonly maskedEmail: string | null;
  readonly maskedName: string;
  readonly maskedPhone: string;
  readonly patientNumber: string;
  readonly registeredAt: string;
  readonly revision: number;
  readonly lifecycleRevision: number;
  readonly lifecycleState: "current" | "archived";
  readonly status: "active" | "inactive";
  readonly updatedAt: string;
}

export interface PatientTimelineEvent {
  readonly eventCode: PatientTimelineEventCode;
  readonly label: string;
  readonly occurredAt: string;
  readonly referenceId: string;
}

export interface PatientProfileResult {
  readonly profile: MaskedPatientProfile;
  readonly timeline: readonly PatientTimelineEvent[];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function readPatientProfile(
  transaction: TenantTransaction,
  input: {
    readonly applicationSessionId: string;
    readonly includeInactive?: boolean;
    readonly includeArchived?: boolean;
    readonly patientId: string;
    readonly providerIdentityId: string;
  },
): Promise<PatientProfileResult | null> {
  for (const value of [input.applicationSessionId, input.providerIdentityId, input.patientId]) {
    if (!uuidPattern.test(value)) {
      throw new DatabaseBoundaryError("Patient profile context is invalid.");
    }
  }
  const result = await transaction.query<{ readonly result: PatientProfileResult | null }>(
    `select graftvision_private.read_patient_profile_lifecycle(
      $1::uuid, $2::uuid, $3::uuid, $4::boolean, $5::boolean
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.patientId,
      input.includeInactive ?? false,
      input.includeArchived ?? false,
    ],
  );
  return result.rows[0]?.result ?? null;
}
