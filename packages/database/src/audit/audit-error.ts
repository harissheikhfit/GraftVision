import "server-only";

import { AUDIT_ERROR_CODES, type AuditErrorCode } from "./audit-types";

const errorMessages: Readonly<Record<AuditErrorCode, string>> = {
  AUDIT_ACTOR_CONTEXT_REQUIRED: "Trusted audit actor context is required.",
  AUDIT_METADATA_TOO_LARGE: "Audit metadata exceeds the approved size limit.",
  AUDIT_TENANT_CONTEXT_REQUIRED: "Trusted audit tenant context is required.",
  AUDIT_WRITE_FAILED: "The required audit event could not be written.",
  INVALID_AUDIT_ACTION: "Audit action is invalid.",
  INVALID_AUDIT_METADATA: "Audit metadata is invalid.",
  INVALID_AUDIT_OUTCOME: "Audit outcome is invalid.",
  INVALID_AUDIT_REQUEST_ID: "Audit request identifier is invalid.",
  INVALID_AUDIT_RESOURCE: "Audit resource type is invalid.",
  INVALID_AUDIT_RESOURCE_ID: "Audit resource identifier is invalid.",
  INVALID_AUDIT_SOURCE_APPLICATION: "Audit source application is invalid.",
};

export class AuditWriteError extends Error {
  public readonly code: AuditErrorCode;

  public constructor(code: AuditErrorCode) {
    super(errorMessages[code]);
    this.name = "AuditWriteError";
    this.code = code;
  }
}

export function isAuditErrorCode(value: string): value is AuditErrorCode {
  return (AUDIT_ERROR_CODES as readonly string[]).includes(value);
}
