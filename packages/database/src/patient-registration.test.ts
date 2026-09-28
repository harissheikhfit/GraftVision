import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_DUPLICATE_MATCH_REASONS,
  PATIENT_DUPLICATE_OVERRIDE_REASONS,
  PATIENT_REGISTRATION_PERMISSION,
  PATIENT_REGISTRATION_PROVENANCE,
  registerPatient,
  validatePatientRegistration,
} from "./patient-registration";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};

describe("patient registration boundary", () => {
  it("preserves the approved catalogue and controlled codes", () => {
    expect(PATIENT_REGISTRATION_PERMISSION).toBe("PATIENT-PERM-001");
    expect(PATIENT_REGISTRATION_PROVENANCE).toBe("REGISTRATION_FORM");
    expect(PATIENT_DUPLICATE_MATCH_REASONS).toEqual([
      "PHONE_EXACT",
      "EMAIL_EXACT",
      "NAME_DOB_EXACT",
    ]);
    expect(PATIENT_DUPLICATE_OVERRIDE_REASONS).toEqual([
      "CONFIRMED_DISTINCT_PERSON",
      "KNOWN_SEPARATE_RECORD",
    ]);
  });

  it("accepts only bounded registration values", () => {
    expect(() => {
      validatePatientRegistration({
        dateOfBirth: "1990-02-03",
        email: "synthetic@example.test",
        fullName: "Synthetic Patient",
        phone: "+923001234567",
      });
    }).not.toThrow();
    expect(() => {
      validatePatientRegistration({
        dateOfBirth: "invalid",
        fullName: "X",
        phone: "03001234567",
      });
    }).toThrow(DatabaseBoundaryError);
  });

  it("returns only the minimal patient projection after creation", async () => {
    const createdAt = new Date("2026-07-28T00:00:00Z");
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          created_at: createdAt,
          duplicates: [],
          id: "33333333-3333-4333-8333-333333333333",
          outcome: "created",
          patient_number: "GV-000001",
          revision: 1,
          status: "active",
          updated_at: createdAt,
        },
      ],
    });
    await expect(
      registerPatient(
        { query },
        {
          ...context,
          dateOfBirth: "1990-02-03",
          fullName: "Synthetic Patient",
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          phone: "+923001234567",
        },
      ),
    ).resolves.toEqual({
      outcome: "created",
      patient: {
        createdAt,
        id: "33333333-3333-4333-8333-333333333333",
        patientNumber: "GV-000001",
        revision: 1,
        status: "active",
        updatedAt: createdAt,
      },
    });
  });

  it("returns the bounded masked duplicate projection", async () => {
    const duplicate = {
      birthYear: 1990,
      hasEmail: true,
      hasPhone: true,
      maskedName: "S••••••••",
      maskedPatientNumber: "GV-****01",
      matchReasonCodes: ["PHONE_EXACT"],
      patientReference: "33333333-3333-4333-8333-333333333333",
    } as const;
    const query = vi.fn().mockResolvedValue({
      rows: [{ duplicates: [duplicate], outcome: "duplicate_warning" }],
    });
    await expect(
      registerPatient(
        { query },
        {
          ...context,
          dateOfBirth: "1990-02-03",
          fullName: "Synthetic Patient",
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          phone: "+923001234567",
        },
      ),
    ).resolves.toEqual({ duplicates: [duplicate], outcome: "duplicate_warning" });
  });

  it("rejects forged context before querying", async () => {
    await expect(
      registerPatient(
        { query: vi.fn() },
        {
          ...context,
          applicationSessionId: "forged",
          dateOfBirth: "1990-02-03",
          fullName: "Synthetic Patient",
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          phone: "+923001234567",
        },
      ),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});
