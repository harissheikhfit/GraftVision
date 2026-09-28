import "server-only";

import { AuditWriteError } from "./audit-error";
import {
  AUDIT_METADATA_KEYS,
  AUDIT_METADATA_MAX_BYTES,
  type AuditMetadata,
  type AuditMetadataKey,
} from "./audit-types";

const metadataKeySet = new Set<string>(AUDIT_METADATA_KEYS);
const safeCodePattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/u;
const changedFieldPattern = /^[a-z][a-z0-9_]{0,62}$/u;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafeCode(value: unknown): asserts value is string {
  if (typeof value !== "string" || !safeCodePattern.test(value)) {
    throw new AuditWriteError("INVALID_AUDIT_METADATA");
  }
}

function assertChangedFields(value: unknown): asserts value is readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    value.some((field) => typeof field !== "string" || !changedFieldPattern.test(field))
  ) {
    throw new AuditWriteError("INVALID_AUDIT_METADATA");
  }
}

function validateMetadataValue(key: AuditMetadataKey, value: unknown): void {
  if (
    key === "affected_count" ||
    key === "current_revision" ||
    key === "expected_revision" ||
    key === "new_version"
  ) {
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
      throw new AuditWriteError("INVALID_AUDIT_METADATA");
    }
    return;
  }

  if (key === "changed_fields") {
    assertChangedFields(value);
    return;
  }

  assertSafeCode(value);
}

export function validateAuditMetadata(value: unknown): AuditMetadata {
  if (!isPlainObject(value)) {
    throw new AuditWriteError("INVALID_AUDIT_METADATA");
  }

  for (const [key, metadataValue] of Object.entries(value)) {
    if (!metadataKeySet.has(key)) {
      throw new AuditWriteError("INVALID_AUDIT_METADATA");
    }

    validateMetadataValue(key as AuditMetadataKey, metadataValue);
  }

  let serialised: string;

  try {
    serialised = JSON.stringify(value);
  } catch {
    throw new AuditWriteError("INVALID_AUDIT_METADATA");
  }

  if (Buffer.byteLength(serialised, "utf8") > AUDIT_METADATA_MAX_BYTES) {
    throw new AuditWriteError("AUDIT_METADATA_TOO_LARGE");
  }

  return value;
}
