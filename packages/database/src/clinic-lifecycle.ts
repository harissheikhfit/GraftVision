import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CLINIC_LIFECYCLE_PERMISSION = "ADMIN-PERM-006" as const;
export const CLINIC_STATUSES = ["active", "suspended", "inactive"] as const;
export const CLINIC_LIFECYCLE_REASON_CODES = [
  "PLATFORM_APPROVED",
  "OPERATIONAL_HOLD",
  "OPERATIONAL_RESOLVED",
  "PLATFORM_INACTIVATED",
] as const;

export type ClinicStatus = (typeof CLINIC_STATUSES)[number];
export type ClinicLifecycleReasonCode = (typeof CLINIC_LIFECYCLE_REASON_CODES)[number];

export interface PlatformAuthorityContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface CreateClinicInput extends PlatformAuthorityContext {
  readonly clinicCode: string;
  readonly displayName: string;
  readonly initialStatus: ClinicStatus;
  readonly timezone: string;
}

export interface TransitionClinicStatusInput extends PlatformAuthorityContext {
  readonly clinicId: string;
  readonly newStatus: ClinicStatus;
  readonly reasonCode: Exclude<ClinicLifecycleReasonCode, "PLATFORM_APPROVED">;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const clinicCodePattern = /^[a-z][a-z0-9-]{2,62}$/u;
const prohibitedCodes = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "clinic",
  "graftvision",
  "platform",
  "public",
  "root",
  "support",
  "system",
]);
const prohibitedNames = new Set(["null", "test", "undefined", "unknown", "unnamed"]);

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} must be a valid UUID.`);
  }
}

function assertPlatformContext(context: PlatformAuthorityContext): void {
  assertUuid(context.applicationSessionId, "applicationSessionId");
  assertUuid(context.providerIdentityId, "providerIdentityId");
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });
}

export async function createClinic(
  transaction: TenantTransaction,
  input: CreateClinicInput,
): Promise<string> {
  assertPlatformContext(input);
  if (
    !clinicCodePattern.test(input.clinicCode) ||
    prohibitedCodes.has(input.clinicCode) ||
    input.clinicCode !== input.clinicCode.trim().toLowerCase()
  ) {
    throw new DatabaseBoundaryError("clinicCode is invalid.");
  }

  const displayName = input.displayName.trim();
  if (
    displayName !== input.displayName ||
    displayName.length < 1 ||
    displayName.length > 160 ||
    prohibitedNames.has(displayName.toLowerCase()) ||
    hasControlCharacter(displayName)
  ) {
    throw new DatabaseBoundaryError("displayName is invalid.");
  }

  try {
    const result = await transaction.query<{ readonly clinic_id: string }>(
      `select graftvision_private.create_clinic_with_settings(
        $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, 'PLATFORM_APPROVED'
      ) as clinic_id`,
      [
        input.applicationSessionId,
        input.providerIdentityId,
        input.clinicCode,
        input.displayName,
        input.timezone,
        input.initialStatus,
      ],
    );
    const clinicId = result.rows[0]?.clinic_id;
    if (!clinicId) {
      throw new Error("missing clinic result");
    }
    return clinicId;
  } catch {
    throw new DatabaseBoundaryError("Clinic creation failed.");
  }
}

export async function transitionClinicStatus(
  transaction: TenantTransaction,
  input: TransitionClinicStatusInput,
): Promise<void> {
  assertPlatformContext(input);
  assertUuid(input.clinicId, "clinicId");

  try {
    const result = await transaction.query<{ readonly transitioned: boolean }>(
      `select graftvision_private.transition_clinic_status(
        $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
      ) as transitioned`,
      [
        input.applicationSessionId,
        input.providerIdentityId,
        input.clinicId,
        input.newStatus,
        input.reasonCode,
      ],
    );
    if (result.rows[0]?.transitioned !== true) {
      throw new Error("missing transition result");
    }
  } catch {
    throw new DatabaseBoundaryError("Clinic status transition failed.");
  }
}
