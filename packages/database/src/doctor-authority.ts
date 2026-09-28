import "server-only";

import { DatabaseBoundaryError } from "./server";

import type { TenantTransaction } from "./server";

export const DOCTOR_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "revoked",
  "expired",
] as const;

export const DOCTOR_VERIFICATION_REASON_CODES = [
  "INITIAL_REVIEW",
  "VERIFICATION_APPROVED",
  "VERIFICATION_REJECTED",
  "VERIFICATION_REVOKED",
  "VERIFICATION_EXPIRED",
  "REVERIFICATION_REQUIRED",
] as const;

export const DOCTOR_VERIFICATION_EVIDENCE_TYPES = [
  "professional_registration",
  "clinic_credentialing",
  "other_reviewed",
] as const;

export type DoctorVerificationStatus = (typeof DOCTOR_VERIFICATION_STATUSES)[number];
export type DoctorVerificationReasonCode = (typeof DOCTOR_VERIFICATION_REASON_CODES)[number];
export type DoctorVerificationEvidenceType = (typeof DOCTOR_VERIFICATION_EVIDENCE_TYPES)[number];

export interface DoctorVerificationTransition {
  readonly evidenceType?: DoctorVerificationEvidenceType;
  readonly expiresAt?: Date;
  readonly internalNote?: string;
  readonly issuingAuthority?: string;
  readonly newStatus: DoctorVerificationStatus;
  readonly reasonCode: DoctorVerificationReasonCode;
  readonly referenceIdentifier?: string;
  readonly sessionId: string;
  readonly targetPlatformUserId: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const permissionPattern = /^[A-Z]+(?:-[A-Z]+)*-[0-9]{3}$/u;

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new DatabaseBoundaryError(`${name} must be a valid UUID.`);
  }
}

function assertRestrictedText(value: string | undefined, name: string, maximum: number): void {
  if (value !== undefined && (value.trim().length === 0 || value.trim().length > maximum)) {
    throw new DatabaseBoundaryError(`${name} is invalid.`);
  }
}

export async function transitionDoctorVerification(
  transaction: TenantTransaction,
  transition: DoctorVerificationTransition,
): Promise<string> {
  assertUuid(transition.sessionId, "sessionId");
  assertUuid(transition.targetPlatformUserId, "targetPlatformUserId");
  assertRestrictedText(transition.issuingAuthority, "issuingAuthority", 160);
  assertRestrictedText(transition.referenceIdentifier, "referenceIdentifier", 160);
  assertRestrictedText(transition.internalNote, "internalNote", 280);

  if (transition.newStatus === "verified") {
    if (
      transition.expiresAt === undefined ||
      transition.evidenceType === undefined ||
      transition.issuingAuthority === undefined ||
      transition.referenceIdentifier === undefined
    ) {
      throw new DatabaseBoundaryError("Verified status requires controlled evidence metadata.");
    }
  } else if (transition.expiresAt !== undefined) {
    throw new DatabaseBoundaryError("Only verified status may include an expiry.");
  }

  try {
    const result = await transaction.query<{ readonly verification_id: string }>(
      `select graftvision_private.transition_doctor_verification(
        $1::uuid, $2::uuid, $3::text, $4::text, $5::timestamptz,
        $6::text, $7::text, $8::text, $9::text
      ) as verification_id`,
      [
        transition.sessionId,
        transition.targetPlatformUserId,
        transition.newStatus,
        transition.reasonCode,
        transition.expiresAt?.toISOString() ?? null,
        transition.evidenceType ?? null,
        transition.issuingAuthority ?? null,
        transition.referenceIdentifier ?? null,
        transition.internalNote ?? null,
      ],
    );
    const verificationId = result.rows[0]?.verification_id;
    if (!verificationId) {
      throw new Error("missing verification result");
    }
    return verificationId;
  } catch {
    throw new DatabaseBoundaryError("Doctor verification transition failed.");
  }
}

export async function hasDoctorAuthority(
  transaction: TenantTransaction,
  sessionId: string,
  requiredPermission: string,
): Promise<boolean> {
  assertUuid(sessionId, "sessionId");
  if (!permissionPattern.test(requiredPermission)) {
    throw new DatabaseBoundaryError("requiredPermission is invalid.");
  }

  try {
    const result = await transaction.query<{ readonly allowed: boolean }>(
      `select graftvision_private.has_doctor_authority($1::uuid, $2::text) as allowed`,
      [sessionId, requiredPermission],
    );
    return result.rows[0]?.allowed === true;
  } catch {
    throw new DatabaseBoundaryError("Doctor authority check failed.");
  }
}
