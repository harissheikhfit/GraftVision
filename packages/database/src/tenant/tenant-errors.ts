import "server-only";

export const TENANT_ERROR_CODES = [
  "INVALID_TENANT_IDENTIFIER",
  "TENANT_CONTEXT_MISSING",
  "TENANT_CONTEXT_SETUP_FAILED",
  "TENANT_CONTEXT_SWITCH_REJECTED",
  "TENANT_MEMBERSHIP_REQUIRED",
] as const;

export type TenantErrorCode = (typeof TENANT_ERROR_CODES)[number];

const messages: Readonly<Record<TenantErrorCode, string>> = {
  INVALID_TENANT_IDENTIFIER: "Tenant identifier is invalid.",
  TENANT_CONTEXT_MISSING: "Trusted tenant context is missing.",
  TENANT_CONTEXT_SETUP_FAILED: "Trusted tenant context could not be established.",
  TENANT_CONTEXT_SWITCH_REJECTED: "Trusted tenant context cannot change in this transaction.",
  TENANT_MEMBERSHIP_REQUIRED: "An active tenant membership is required.",
};

export class TenantBoundaryError extends Error {
  public readonly code: TenantErrorCode;

  public constructor(code: TenantErrorCode) {
    super(messages[code]);
    this.name = "TenantBoundaryError";
    this.code = code;
  }
}
