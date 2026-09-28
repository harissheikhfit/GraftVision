import "server-only";

import { createHash } from "node:crypto";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const CLINIC_STAFF_PERMISSION = "ADMIN-PERM-003" as const;
export const CLINIC_STAFF_EXPIRY_DAYS = 7 as const;
export const CLINIC_ROLE_CODES = [
  "CLINIC_OWNER",
  "CLINIC_ADMIN",
  "DOCTOR",
  "CLINICAL_ASSISTANT",
  "PROCEDURE_TECHNICIAN",
  "RECEPTION",
  "REPORT_COORDINATOR",
  "PRESENTATION",
  "REVIEWER",
] as const;
export const CLINIC_ADMIN_MANAGED_ROLE_CODES = [
  "CLINICAL_ASSISTANT",
  "PROCEDURE_TECHNICIAN",
  "RECEPTION",
  "REPORT_COORDINATOR",
  "PRESENTATION",
  "REVIEWER",
] as const;

export type ClinicStaffRoleCode = (typeof CLINIC_ROLE_CODES)[number];
export type ClinicStaffManagerRole = "CLINIC_ADMIN" | "CLINIC_OWNER";

export interface ClinicStaffContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ClinicStaffRecord {
  readonly membershipId: string;
  readonly membershipStatus: "active" | "revoked" | "suspended";
  readonly platformUserId: string;
  readonly roleCodes: readonly ClinicStaffRoleCode[];
}

export interface PendingClinicInvitation {
  readonly expiresAt: Date;
  readonly invitationId: string;
  readonly normalizedEmail: string;
  readonly roleCodes: readonly ClinicStaffRoleCode[];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} must be a valid UUID.`);
  }
}

function assertContext(context: ClinicStaffContext): void {
  assertUuid(context.applicationSessionId, "applicationSessionId");
  assertUuid(context.providerIdentityId, "providerIdentityId");
}

export function normalizeClinicStaffEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !emailPattern.test(normalized) ||
    normalized.includes("..")
  ) {
    throw new DatabaseBoundaryError("email is invalid.");
  }
  return normalized;
}

export function hashProviderInvitationReference(reference: string): string {
  if (reference.length < 16 || reference.length > 512) {
    throw new DatabaseBoundaryError("provider invitation reference is invalid.");
  }
  return createHash("sha256").update(reference, "utf8").digest("hex");
}

function assertRoles(roleCodes: readonly ClinicStaffRoleCode[]): void {
  if (roleCodes.length === 0 || new Set(roleCodes).size !== roleCodes.length) {
    throw new DatabaseBoundaryError("roleCodes are invalid.");
  }
}

export async function createClinicStaffInvitation(
  transaction: TenantTransaction,
  input: ClinicStaffContext & {
    readonly email: string;
    readonly providerReference: string;
    readonly roleCodes: readonly ClinicStaffRoleCode[];
  },
): Promise<string> {
  assertContext(input);
  assertRoles(input.roleCodes);
  const result = await transaction.query<{ readonly invitation_id: string }>(
    `select graftvision_private.create_clinic_invitation(
      $1::uuid, $2::uuid, $3::text, $4::text, $5::text[], $6::integer
    ) as invitation_id`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      normalizeClinicStaffEmail(input.email),
      hashProviderInvitationReference(input.providerReference),
      input.roleCodes,
      CLINIC_STAFF_EXPIRY_DAYS,
    ],
  );
  const invitationId = result.rows[0]?.invitation_id;
  if (!invitationId) throw new DatabaseBoundaryError("Clinic invitation failed.");
  return invitationId;
}

export async function transitionClinicStaffInvitation(
  transaction: TenantTransaction,
  input: ClinicStaffContext & {
    readonly action: "resend" | "revoke";
    readonly invitationId: string;
    readonly providerReference?: string;
  },
): Promise<void> {
  assertContext(input);
  assertUuid(input.invitationId, "invitationId");
  const referenceHash =
    input.action === "resend" && input.providerReference
      ? hashProviderInvitationReference(input.providerReference)
      : null;
  if (input.action === "resend" && referenceHash === null) {
    throw new DatabaseBoundaryError("Resend requires a provider invitation reference.");
  }
  await transaction.query(
    `select graftvision_private.transition_clinic_invitation(
      $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
    )`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.invitationId,
      input.action,
      referenceHash,
    ],
  );
}

export async function acceptClinicStaffInvitation(
  transaction: TenantTransaction,
  input: {
    readonly email: string;
    readonly invitationId: string;
    readonly platformUserId: string;
    readonly providerReference: string;
  },
): Promise<string> {
  assertUuid(input.invitationId, "invitationId");
  assertUuid(input.platformUserId, "platformUserId");
  const result = await transaction.query<{ readonly membership_id: string }>(
    `select graftvision_private.accept_clinic_invitation(
      $1::uuid, $2::uuid, $3::text, $4::text
    ) as membership_id`,
    [
      input.invitationId,
      input.platformUserId,
      normalizeClinicStaffEmail(input.email),
      hashProviderInvitationReference(input.providerReference),
    ],
  );
  const membershipId = result.rows[0]?.membership_id;
  if (!membershipId) throw new DatabaseBoundaryError("Invitation acceptance failed.");
  return membershipId;
}

export async function setClinicStaffRoles(
  transaction: TenantTransaction,
  input: ClinicStaffContext & {
    readonly membershipId: string;
    readonly roleCodes: readonly ClinicStaffRoleCode[];
  },
): Promise<void> {
  assertContext(input);
  assertUuid(input.membershipId, "membershipId");
  assertRoles(input.roleCodes);
  await transaction.query(
    `select graftvision_private.set_clinic_membership_roles(
      $1::uuid, $2::uuid, $3::uuid, $4::text[]
    )`,
    [input.applicationSessionId, input.providerIdentityId, input.membershipId, input.roleCodes],
  );
}

export async function deactivateClinicStaff(
  transaction: TenantTransaction,
  input: ClinicStaffContext & { readonly membershipId: string },
): Promise<void> {
  assertContext(input);
  assertUuid(input.membershipId, "membershipId");
  await transaction.query(
    `select graftvision_private.deactivate_clinic_staff($1::uuid, $2::uuid, $3::uuid)`,
    [input.applicationSessionId, input.providerIdentityId, input.membershipId],
  );
}

export async function listClinicStaff(
  transaction: TenantTransaction,
  context: ClinicStaffContext,
): Promise<readonly ClinicStaffRecord[]> {
  assertContext(context);
  const result = await transaction.query<{
    readonly membership_id: string;
    readonly membership_status: ClinicStaffRecord["membershipStatus"];
    readonly platform_user_id: string;
    readonly role_codes: ClinicStaffRoleCode[];
  }>(`select * from graftvision_private.list_clinic_staff($1::uuid, $2::uuid)`, [
    context.applicationSessionId,
    context.providerIdentityId,
  ]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    membershipStatus: row.membership_status,
    platformUserId: row.platform_user_id,
    roleCodes: row.role_codes,
  }));
}

export async function getClinicStaffManagerRole(
  transaction: TenantTransaction,
  context: ClinicStaffContext,
): Promise<ClinicStaffManagerRole> {
  assertContext(context);
  const result = await transaction.query<{ readonly actor_role: ClinicStaffManagerRole | null }>(
    `select graftvision_private.staff_actor_role($1::uuid, $2::uuid) as actor_role`,
    [context.applicationSessionId, context.providerIdentityId],
  );
  const role = result.rows[0]?.actor_role;
  if (role !== "CLINIC_ADMIN" && role !== "CLINIC_OWNER") {
    throw new DatabaseBoundaryError("Clinic staff management permission is required.");
  }
  return role;
}

export async function listPendingClinicInvitations(
  transaction: TenantTransaction,
  context: ClinicStaffContext,
): Promise<readonly PendingClinicInvitation[]> {
  assertContext(context);
  const result = await transaction.query<{
    readonly expires_at: Date;
    readonly invitation_id: string;
    readonly normalized_email: string;
    readonly role_codes: ClinicStaffRoleCode[];
  }>(`select * from graftvision_private.list_pending_clinic_invitations($1::uuid, $2::uuid)`, [
    context.applicationSessionId,
    context.providerIdentityId,
  ]);
  return result.rows.map((row) => ({
    expiresAt: row.expires_at,
    invitationId: row.invitation_id,
    normalizedEmail: row.normalized_email,
    roleCodes: row.role_codes,
  }));
}
