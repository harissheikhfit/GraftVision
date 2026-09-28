import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_PROFILE_PERMISSION,
  PATIENT_TIMELINE_EVENT_CODES,
  readPatientProfile,
} from "./patient-profile";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  patientId: "22222222-2222-4222-8222-222222222222",
  providerIdentityId: "33333333-3333-4333-8333-333333333333",
};

describe("patient profile boundary", () => {
  it("preserves PATIENT-PERM-001 and the curated event allowlist", () => {
    expect(PATIENT_PROFILE_PERMISSION).toBe("PATIENT-PERM-001");
    expect(PATIENT_TIMELINE_EVENT_CODES).toEqual([
      "PATIENT_CREATED",
      "REGISTRATION_CREATED",
      "DUPLICATE_OVERRIDE",
      "PATIENT_STATUS_CHANGED",
      "PATIENT_ARCHIVED",
      "PATIENT_RESTORED",
    ]);
  });

  it("returns the masked profile and curated timeline projection", async () => {
    const projection = {
      profile: {
        id: context.patientId,
        maskedDateOfBirth: "1990",
        maskedEmail: "s•••@example.test",
        maskedName: "S••••••••",
        maskedPhone: "•••••••••••67",
        patientNumber: "GV-000001",
        registeredAt: "2026-07-29T00:00:00Z",
        revision: 1,
        status: "active",
        updatedAt: "2026-07-29T00:00:00Z",
      },
      timeline: [
        {
          eventCode: "REGISTRATION_CREATED",
          label: "Registration details created",
          occurredAt: "2026-07-29T00:00:00Z",
          referenceId: "44444444-4444-4444-8444-444444444444",
        },
      ],
    } as const;
    const query = vi.fn().mockResolvedValue({ rows: [{ result: projection }] });
    await expect(readPatientProfile({ query }, context)).resolves.toEqual(projection);
    expect(JSON.stringify(projection)).not.toMatch(
      /normalisedName|actorPlatformUserId|auditMetadata|provenance|idempotency/iu,
    );
  });

  it("supports explicit inactive lookup and rejects forged IDs", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: null }] });
    await readPatientProfile({ query }, { ...context, includeInactive: true });
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      context.applicationSessionId,
      context.providerIdentityId,
      context.patientId,
      true,
      false,
    ]);
    await expect(
      readPatientProfile({ query }, { ...context, patientId: "forged" }),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});
