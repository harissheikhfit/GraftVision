import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CLINIC_ONBOARDING_PERMISSION = "ADMIN-PERM-001" as const;
export const CLINIC_ONBOARDING_ATTESTATION_CODES = [
  "PROTOCOL_TEMPLATE_READY",
  "SECURITY_READY",
] as const;
export const CLINIC_ONBOARDING_STATES = ["not_ready", "ready", "reopened"] as const;

export type ClinicOnboardingAttestationCode = (typeof CLINIC_ONBOARDING_ATTESTATION_CODES)[number];
export type ClinicOnboardingState = (typeof CLINIC_ONBOARDING_STATES)[number];
export type ClinicOnboardingAttestationStatus = "attested" | "missing" | "withdrawn";

export interface ClinicOnboardingContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ClinicOnboardingChecklist {
  readonly brandingPresent: boolean;
  readonly clinicActive: boolean;
  readonly clinicOwner: boolean;
  readonly clinicProfile: boolean;
  readonly protocolTemplateReady: boolean;
  readonly securityReady: boolean;
  readonly staffConfigured: boolean;
  readonly timezoneValid: boolean;
  readonly verifiedDoctor: boolean;
}

export interface ClinicOnboardingAttestation {
  readonly expiresAt: Date | null;
  readonly revision: number;
  readonly status: ClinicOnboardingAttestationStatus;
}

export interface ClinicOnboarding {
  readonly checklist: ClinicOnboardingChecklist;
  readonly clinicId: string;
  readonly protocolTemplate: ClinicOnboardingAttestation;
  readonly readinessRevision: number;
  readonly security: ClinicOnboardingAttestation;
  readonly state: ClinicOnboardingState;
}

export type ClinicOnboardingUpdateResult = "conflict" | "updated";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertContext(context: ClinicOnboardingContext): void {
  if (
    !uuidPattern.test(context.applicationSessionId) ||
    !uuidPattern.test(context.providerIdentityId)
  ) {
    throw new DatabaseBoundaryError("Clinic onboarding context is invalid.");
  }
}

function asBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new DatabaseBoundaryError("Clinic onboarding checklist is invalid.");
  }
  return value;
}

export async function readClinicOnboarding(
  transaction: TenantTransaction,
  context: ClinicOnboardingContext,
): Promise<ClinicOnboarding> {
  assertContext(context);
  const result = await transaction.query<{
    readonly checklist: Record<string, unknown>;
    readonly clinic_id: string;
    readonly protocol_expires_at: Date | null;
    readonly protocol_revision: number;
    readonly protocol_status: ClinicOnboardingAttestationStatus;
    readonly readiness_revision: number;
    readonly readiness_state: ClinicOnboardingState;
    readonly security_expires_at: Date | null;
    readonly security_revision: number;
    readonly security_status: ClinicOnboardingAttestationStatus;
  }>("select * from graftvision_private.read_clinic_onboarding($1::uuid, $2::uuid)", [
    context.applicationSessionId,
    context.providerIdentityId,
  ]);
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Clinic onboarding is unavailable.");
  return {
    checklist: {
      brandingPresent: asBoolean(row.checklist, "branding_present"),
      clinicActive: asBoolean(row.checklist, "clinic_active"),
      clinicOwner: asBoolean(row.checklist, "clinic_owner"),
      clinicProfile: asBoolean(row.checklist, "clinic_profile"),
      protocolTemplateReady: asBoolean(row.checklist, "protocol_template_ready"),
      securityReady: asBoolean(row.checklist, "security_ready"),
      staffConfigured: asBoolean(row.checklist, "staff_configured"),
      timezoneValid: asBoolean(row.checklist, "timezone_valid"),
      verifiedDoctor: asBoolean(row.checklist, "verified_doctor"),
    },
    clinicId: row.clinic_id,
    protocolTemplate: {
      expiresAt: row.protocol_expires_at,
      revision: row.protocol_revision,
      status: row.protocol_status,
    },
    readinessRevision: row.readiness_revision,
    security: {
      expiresAt: row.security_expires_at,
      revision: row.security_revision,
      status: row.security_status,
    },
    state: row.readiness_state,
  };
}

export async function attestClinicOnboarding(
  transaction: TenantTransaction,
  input: ClinicOnboardingContext & {
    readonly attestationCode: ClinicOnboardingAttestationCode;
    readonly expectedRevision: number;
    readonly expiresAt?: Date;
    readonly status: "attested" | "withdrawn";
  },
): Promise<ClinicOnboardingUpdateResult> {
  assertContext(input);
  if (!CLINIC_ONBOARDING_ATTESTATION_CODES.includes(input.attestationCode)) {
    throw new DatabaseBoundaryError("attestationCode is invalid.");
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  if (
    input.expiresAt &&
    (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= new Date())
  ) {
    throw new DatabaseBoundaryError("expiresAt is invalid.");
  }
  const result = await transaction.query<{ readonly result: ClinicOnboardingUpdateResult }>(
    `select graftvision_private.attest_clinic_onboarding(
      $1::uuid, $2::uuid, $3::text, $4::text, $5::integer, $6::timestamptz
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.attestationCode,
      input.status,
      input.expectedRevision,
      input.expiresAt ?? null,
    ],
  );
  const outcome = result.rows[0]?.result;
  if (!outcome) throw new DatabaseBoundaryError("Clinic onboarding update failed.");
  return outcome;
}
