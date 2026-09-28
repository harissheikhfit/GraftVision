import { describe, expect, it, vi } from "vitest";

import {
  AUDIT_METADATA_MAX_BYTES,
  AuditWriteError,
  isAuditErrorCode,
  validateAuditAction,
  validateAuditMetadata,
  validateAuditOutcome,
  validateAuditRequestId,
  validateAuditResourceId,
  validateAuditResourceType,
  validateAuditSourceApplication,
  writeAuditEvent,
  type AuditEventInput,
} from "./index";

import type { TenantTransaction } from "../server";
import type { QueryResult } from "pg";

const auditId = "99999999-9999-4999-8999-999999999999";
const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestId = "77777777-7777-4777-8777-777777777777";

const validInput: AuditEventInput = {
  action: "clinic.read",
  metadata: {
    affected_count: 1,
    changed_fields: ["status"],
    policy_decision_code: "membership.active",
  },
  outcome: "success",
  reasonCode: "policy.allowed",
  requestId,
  resourceId,
  resourceType: "clinic",
  sourceApplication: "web",
};

function createTransactionFixture(
  options: { readonly rejects?: boolean; readonly row?: unknown } = {},
) {
  const query = vi.fn((_text: string, _values?: readonly unknown[]): Promise<QueryResult> =>
    options.rejects
      ? Promise.reject(new Error("postgresql://user:secret@db.example.test/private"))
      : Promise.resolve({
          rows: [options.row ?? { audit_event_id: auditId }],
        } as unknown as QueryResult),
  );

  return {
    query,
    transaction: { query } as unknown as TenantTransaction,
  };
}

describe("audit taxonomy validation", () => {
  it.each([
    ["audit.correct", validateAuditAction],
    ["audit_event", validateAuditResourceType],
    ["denied", validateAuditOutcome],
    ["scan", validateAuditSourceApplication],
  ] as const)("accepts controlled value %s", (value, validator) => {
    expect(validator(value)).toBe(value);
  });

  it.each([
    ["Clinic Read", validateAuditAction, "INVALID_AUDIT_ACTION"],
    ["unknown_resource", validateAuditResourceType, "INVALID_AUDIT_RESOURCE"],
    ["unknown", validateAuditOutcome, "INVALID_AUDIT_OUTCOME"],
    ["worker", validateAuditSourceApplication, "INVALID_AUDIT_SOURCE_APPLICATION"],
  ] as const)("rejects uncontrolled value %s", (value, validator, code) => {
    expect(() => validator(value)).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({ code }),
    );
  });

  it("recognises only stable audit error codes", () => {
    expect(isAuditErrorCode("AUDIT_WRITE_FAILED")).toBe(true);
    expect(isAuditErrorCode("postgresql://secret")).toBe(false);
  });
});

describe("audit identifier validation", () => {
  it("accepts optional opaque UUID resource and request identifiers", () => {
    expect(validateAuditResourceId(resourceId)).toBe(resourceId);
    expect(validateAuditRequestId(requestId)).toBe(requestId);
    expect(validateAuditResourceId(undefined)).toBeUndefined();
  });

  it("rejects a non-UUID resource identifier", () => {
    expect(() => validateAuditResourceId("clinic-alpha")).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_RESOURCE_ID",
      }),
    );
  });

  it("rejects a URL-like request identifier", () => {
    expect(() => validateAuditRequestId("https://request.example.test/patient?id=1")).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_REQUEST_ID",
      }),
    );
  });
});

describe("audit metadata policy", () => {
  it("accepts every allowlisted safe metadata shape", () => {
    const metadata = {
      affected_count: 2,
      changed_fields: ["membership_status", "updated_at"],
      error_code: "MEMBERSHIP_DENIED",
      new_status: "active",
      policy_decision_code: "tenant.membership.active",
      previous_status: "suspended",
      route_family: "clinic.membership",
      storage_object_class: "clinical-image-original",
    };

    expect(validateAuditMetadata(metadata)).toBe(metadata);
  });

  it.each([
    "password",
    "secret",
    "token",
    "cookie",
    "otp",
    "credential",
    "email",
    "phone",
    "patient_name",
    "medical_history",
    "notes",
    "unrestricted_notes",
    "raw_request_body",
    "full_user_agent",
    "report_content",
    "file_content",
    "signed_url",
    "database_url",
    "stack",
  ])("rejects sensitive-looking unknown key %s", (key) => {
    expect(() => validateAuditMetadata({ [key]: "synthetic" })).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_METADATA",
      }),
    );
  });

  it("keeps the completed authentication audit action matrix available", () => {
    for (const action of [
      "authority.cross_scope_denied",
      "authority.scope_change",
      "doctor.verification.expired",
      "doctor.verification.revoked",
      "session.create",
      "session.deny_inactive_user",
      "session.expire_absolute",
      "session.lock",
      "session.logout_after_lock",
      "session.reauthentication_failed",
      "session.revoke_authorization_change",
      "session.revoke_inactive_membership",
      "session.revoke_inactive_user",
      "session.revoke_other",
      "session.revoke_others",
      "session.unlock",
    ] as const) {
      expect(validateAuditAction(action)).toBe(action);
    }
  });

  it("rejects an otherwise harmless unknown key", () => {
    expect(() => validateAuditMetadata({ arbitrary: "value" })).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_METADATA",
      }),
    );
  });

  it.each([null, [], "metadata", 1])("rejects non-object metadata", (metadata) => {
    expect(() => validateAuditMetadata(metadata)).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_METADATA",
      }),
    );
  });

  it("rejects nested metadata structures", () => {
    expect(() => validateAuditMetadata({ error_code: { nested: "value" } })).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "INVALID_AUDIT_METADATA",
      }),
    );
  });

  it("rejects invalid changed-field names and excessive field counts", () => {
    expect(() => validateAuditMetadata({ changed_fields: ["patient name"] })).toThrow();
    expect(() =>
      validateAuditMetadata({
        changed_fields: Array.from({ length: 33 }, (_, index) => `field_${index}`),
      }),
    ).toThrow();
  });

  it("rejects invalid affected counts", () => {
    expect(() => validateAuditMetadata({ affected_count: -1 })).toThrow();
    expect(() => validateAuditMetadata({ affected_count: 1_000_001 })).toThrow();
    expect(() => validateAuditMetadata({ affected_count: 1.5 })).toThrow();
  });

  it("accepts bounded consultation conflict metadata", () => {
    expect(
      validateAuditMetadata({
        changed_fields: ["status", "consultation_revision"],
        current_revision: 3,
        expected_revision: 2,
        operation_code: "status_transition",
        outcome_code: "stale_revision",
      }),
    ).toEqual({
      changed_fields: ["status", "consultation_revision"],
      current_revision: 3,
      expected_revision: 2,
      operation_code: "status_transition",
      outcome_code: "stale_revision",
    });
  });

  it("rejects metadata beyond the 2048-byte limit without exposing it", () => {
    const oversizedFields = Array.from(
      { length: 32 },
      (_, index) => `field_${index.toString().padStart(2, "0")}_${"x".repeat(53)}`,
    );

    expect(() => validateAuditMetadata({ changed_fields: oversizedFields })).toThrowError(
      expect.objectContaining<Partial<AuditWriteError>>({
        code: "AUDIT_METADATA_TOO_LARGE",
        message: "Audit metadata exceeds the approved size limit.",
      }),
    );
  });

  it("measures UTF-8 bytes conservatively", () => {
    expect(Buffer.byteLength(JSON.stringify({ error_code: "SAFE" }), "utf8")).toBeLessThan(
      AUDIT_METADATA_MAX_BYTES,
    );
  });
});

describe("transactional audit writes", () => {
  it("reuses the supplied transaction and sends one parameterised query", async () => {
    const { query, transaction } = createTransactionFixture();

    await expect(writeAuditEvent(transaction, validInput)).resolves.toBe(auditId);
    expect(query).toHaveBeenCalledOnce();

    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("graftvision_private.write_clinic_audit_event");
    expect(sql).toContain("$1::text");
    expect(sql).toContain("$8::jsonb");
    expect(values).toEqual([
      "clinic.read",
      "clinic",
      resourceId,
      "success",
      "policy.allowed",
      requestId,
      "web",
      JSON.stringify(validInput.metadata),
    ]);
  });

  it("does not accept actor or clinic authority in its input contract", () => {
    expect(Object.keys(validInput)).not.toContain("actorPlatformUserId");
    expect(Object.keys(validInput)).not.toContain("clinicId");
  });

  it("fails closed and redacts database failures", async () => {
    const { transaction } = createTransactionFixture({ rejects: true });

    await expect(writeAuditEvent(transaction, validInput)).rejects.toEqual(
      new AuditWriteError("AUDIT_WRITE_FAILED"),
    );
  });

  it("fails closed when the database returns no opaque event ID", async () => {
    const { transaction } = createTransactionFixture({ row: {} });

    await expect(writeAuditEvent(transaction, validInput)).rejects.toEqual(
      new AuditWriteError("AUDIT_WRITE_FAILED"),
    );
  });

  it("validates before calling the transaction", async () => {
    const { query, transaction } = createTransactionFixture();
    const unsafeInput = {
      ...validInput,
      metadata: { raw_request_body: "synthetic" },
    } as unknown as AuditEventInput;

    await expect(writeAuditEvent(transaction, unsafeInput)).rejects.toMatchObject({
      code: "INVALID_AUDIT_METADATA",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("uses an empty object when optional metadata is absent", async () => {
    const { query, transaction } = createTransactionFixture();
    const { metadata: _metadata, ...withoutMetadata } = validInput;

    await writeAuditEvent(transaction, withoutMetadata);

    expect(query.mock.calls[0]?.[1]?.at(-1)).toBe("{}");
  });

  it("rejects arbitrary reason text before SQL execution", async () => {
    const { query, transaction } = createTransactionFixture();

    await expect(
      writeAuditEvent(transaction, {
        ...validInput,
        reasonCode: "Patient asked for this change",
      }),
    ).rejects.toMatchObject({ code: "INVALID_AUDIT_METADATA" });
    expect(query).not.toHaveBeenCalled();
  });
});
