import "server-only";

import { AuditWriteError } from "./audit-error";
import { validateAuditMetadata } from "./audit-metadata";
import {
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AUDIT_RESOURCE_TYPES,
  AUDIT_SOURCE_APPLICATIONS,
  type AuditAction,
  type AuditEventInput,
  type AuditOutcome,
  type AuditResourceType,
  type AuditSourceApplication,
} from "./audit-types";

import type { TenantTransaction } from "../server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const safeCodePattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/u;
const actionSet = new Set<string>(AUDIT_ACTIONS);
const resourceTypeSet = new Set<string>(AUDIT_RESOURCE_TYPES);
const outcomeSet = new Set<string>(AUDIT_OUTCOMES);
const sourceApplicationSet = new Set<string>(AUDIT_SOURCE_APPLICATIONS);

function assertMember<Value extends string>(
  value: string,
  allowedValues: ReadonlySet<string>,
  code: ConstructorParameters<typeof AuditWriteError>[0],
): Value {
  if (!allowedValues.has(value)) {
    throw new AuditWriteError(code);
  }

  return value as Value;
}

export function validateAuditAction(value: string): AuditAction {
  return assertMember<AuditAction>(value, actionSet, "INVALID_AUDIT_ACTION");
}

export function validateAuditResourceType(value: string): AuditResourceType {
  return assertMember<AuditResourceType>(value, resourceTypeSet, "INVALID_AUDIT_RESOURCE");
}

export function validateAuditOutcome(value: string): AuditOutcome {
  return assertMember<AuditOutcome>(value, outcomeSet, "INVALID_AUDIT_OUTCOME");
}

export function validateAuditSourceApplication(value: string): AuditSourceApplication {
  return assertMember<AuditSourceApplication>(
    value,
    sourceApplicationSet,
    "INVALID_AUDIT_SOURCE_APPLICATION",
  );
}

export function validateAuditResourceId(value: string | undefined): string | undefined {
  if (value !== undefined && !uuidPattern.test(value)) {
    throw new AuditWriteError("INVALID_AUDIT_RESOURCE_ID");
  }

  return value;
}

export function validateAuditRequestId(value: string | undefined): string | undefined {
  if (value !== undefined && !uuidPattern.test(value)) {
    throw new AuditWriteError("INVALID_AUDIT_REQUEST_ID");
  }

  return value;
}

function validateReasonCode(value: string | undefined): string | undefined {
  if (value !== undefined && !safeCodePattern.test(value)) {
    throw new AuditWriteError("INVALID_AUDIT_METADATA");
  }

  return value;
}

export async function writeAuditEvent(
  transaction: TenantTransaction,
  input: AuditEventInput,
): Promise<string> {
  const action = validateAuditAction(input.action);
  const resourceType = validateAuditResourceType(input.resourceType);
  const resourceId = validateAuditResourceId(input.resourceId);
  const outcome = validateAuditOutcome(input.outcome);
  const reasonCode = validateReasonCode(input.reasonCode);
  const requestId = validateAuditRequestId(input.requestId);
  const sourceApplication = validateAuditSourceApplication(input.sourceApplication);
  const metadata = validateAuditMetadata(input.metadata ?? {});

  try {
    const result = await transaction.query<{ readonly audit_event_id: string }>(
      `select graftvision_private.write_clinic_audit_event(
        $1::text,
        $2::text,
        $3::uuid,
        $4::text,
        $5::text,
        $6::uuid,
        $7::text,
        $8::jsonb
      ) as audit_event_id`,
      [
        action,
        resourceType,
        resourceId ?? null,
        outcome,
        reasonCode ?? null,
        requestId ?? null,
        sourceApplication,
        JSON.stringify(metadata),
      ],
    );
    const auditEventId = result.rows[0]?.audit_event_id;

    if (!auditEventId || !uuidPattern.test(auditEventId)) {
      throw new AuditWriteError("AUDIT_WRITE_FAILED");
    }

    return auditEventId;
  } catch {
    throw new AuditWriteError("AUDIT_WRITE_FAILED");
  }
}
