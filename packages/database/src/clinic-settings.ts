import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CLINIC_SETTINGS_PERMISSION = "ADMIN-PERM-001" as const;

export interface ClinicSettingsContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ClinicSettings {
  readonly clinicCode: string;
  readonly clinicId: string;
  readonly displayName: string;
  readonly revision: number;
  readonly timezone: string;
  readonly updatedAt: Date;
  readonly updatedBy: string | null;
}

export type ClinicSettingsUpdateResult = "conflict" | "unchanged" | "updated";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const timezonePattern = /^(?:UTC|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/u;
const prohibitedNames = new Set(["null", "test", "undefined", "unknown", "unnamed"]);

function assertContext(context: ClinicSettingsContext): void {
  if (
    !uuidPattern.test(context.applicationSessionId) ||
    !uuidPattern.test(context.providerIdentityId)
  ) {
    throw new DatabaseBoundaryError("Clinic settings context is invalid.");
  }
}

function validateDisplayName(value: string): void {
  const name = value.trim();
  if (
    name !== value ||
    name.length < 1 ||
    name.length > 160 ||
    prohibitedNames.has(name.toLowerCase()) ||
    [...name].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
    })
  ) {
    throw new DatabaseBoundaryError("displayName is invalid.");
  }
}

function validateTimezone(value: string): void {
  if (value.length > 64 || !timezonePattern.test(value)) {
    throw new DatabaseBoundaryError("timezone is invalid.");
  }
}

export async function readClinicSettings(
  transaction: TenantTransaction,
  context: ClinicSettingsContext,
): Promise<ClinicSettings> {
  assertContext(context);
  const result = await transaction.query<{
    readonly clinic_code: string;
    readonly clinic_id: string;
    readonly display_name: string;
    readonly revision: number;
    readonly timezone: string;
    readonly updated_at: Date;
    readonly updated_by_platform_user_id: string | null;
  }>("select * from graftvision_private.read_clinic_settings($1::uuid, $2::uuid)", [
    context.applicationSessionId,
    context.providerIdentityId,
  ]);
  const row = result.rows[0];
  if (!row) throw new DatabaseBoundaryError("Clinic settings are unavailable.");
  return {
    clinicCode: row.clinic_code,
    clinicId: row.clinic_id,
    displayName: row.display_name,
    revision: row.revision,
    timezone: row.timezone,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_platform_user_id,
  };
}

export async function updateClinicSettings(
  transaction: TenantTransaction,
  input: ClinicSettingsContext & {
    readonly displayName: string;
    readonly expectedRevision: number;
    readonly timezone: string;
  },
): Promise<ClinicSettingsUpdateResult> {
  assertContext(input);
  validateDisplayName(input.displayName);
  validateTimezone(input.timezone);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new DatabaseBoundaryError("expectedRevision is invalid.");
  }
  const result = await transaction.query<{ readonly result: ClinicSettingsUpdateResult }>(
    `select graftvision_private.update_clinic_settings(
      $1::uuid, $2::uuid, $3::integer, $4::text, $5::text, 'PROFILE_UPDATED'
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.expectedRevision,
      input.displayName,
      input.timezone,
    ],
  );
  const outcome = result.rows[0]?.result;
  if (!outcome) throw new DatabaseBoundaryError("Clinic settings update failed.");
  return outcome;
}
