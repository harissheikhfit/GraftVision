import { describe, expect, it, vi } from "vitest";

import {
  assignConsultationDoctor,
  CONSULTATION_DOCTOR_ASSIGNMENT_PERMISSION,
  CONSULTATION_DRAFT_PERMISSION,
  CONSULTATION_STATUSES,
  createConsultation,
  transitionConsultationStatus,
} from "./consultation-foundation";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};
const patientId = "33333333-3333-4333-8333-333333333333";
const consultationId = "44444444-4444-4444-8444-444444444444";
const doctorId = "55555555-5555-4555-8555-555555555555";
const idempotencyKey = "66666666-6666-4666-8666-666666666666";

describe("consultation foundation boundary", () => {
  it("preserves approved permissions and product status labels", () => {
    expect(CONSULTATION_DRAFT_PERMISSION).toBe("CONSULT-PERM-001");
    expect(CONSULTATION_DOCTOR_ASSIGNMENT_PERMISSION).toBe("CONSULT-PERM-003");
    expect(CONSULTATION_STATUSES).toEqual([
      "draft",
      "in-progress",
      "capture-complete",
      "review-required",
      "completed",
      "cancelled",
    ]);
  });

  it("creates a draft through the controlled database operation", async () => {
    const row = {
      assigned_doctor_platform_user_id: null,
      created_at: new Date("2026-07-29T00:00:00Z"),
      id: consultationId,
      patient_id: patientId,
      revision: 1,
      status: "draft",
      updated_at: new Date("2026-07-29T00:00:00Z"),
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    await expect(
      createConsultation({ query }, { ...context, idempotencyKey, patientId }),
    ).resolves.toMatchObject({ id: consultationId, status: "draft" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("create_consultation"), [
      context.applicationSessionId,
      context.providerIdentityId,
      patientId,
      idempotencyKey,
    ]);
  });

  it("assigns a Doctor with revision and controlled reason", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          changed_fields: ["assigned_doctor", "consultation_revision"],
          consultation_id: consultationId,
          doctor_platform_user_id: doctorId,
          operation_code: "doctor_assignment",
          outcome_code: "success",
          revision: 2,
          status: "draft",
          updated_at: new Date("2026-07-29T00:01:00Z"),
        },
      ],
    });
    await expect(
      assignConsultationDoctor(
        { query },
        {
          ...context,
          consultationId,
          doctorPlatformUserId: doctorId,
          expectedRevision: 1,
          idempotencyKey,
          reasonCode: "INITIAL_ASSIGNMENT",
        },
      ),
    ).resolves.toEqual({
      outcome: "success",
      value: {
        consultationId,
        doctorPlatformUserId: doctorId,
        revision: 2,
      },
    });
  });

  it("maps product status labels and rejects forged boundary input", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          changed_fields: ["status", "consultation_revision"],
          consultation_id: consultationId,
          operation_code: "status_transition",
          outcome_code: "success",
          revision: 2,
          status: "in_progress",
          updated_at: new Date("2026-07-29T00:01:00Z"),
        },
      ],
    });
    await expect(
      transitionConsultationStatus(
        { query },
        {
          ...context,
          consultationId,
          expectedRevision: 1,
          idempotencyKey,
          newStatus: "in-progress",
          reasonCode: "PREPARATION_STARTED",
        },
      ),
    ).resolves.toEqual({
      outcome: "success",
      value: { id: consultationId, revision: 2, status: "in-progress" },
    });
    await expect(
      createConsultation({ query }, { ...context, idempotencyKey: "forged", patientId }),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });

  it("returns an allowlisted privacy-safe stale-revision projection", async () => {
    const updatedAt = new Date("2026-07-29T00:02:00Z");
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          changed_fields: ["status", "consultation_revision"],
          consultation_id: consultationId,
          operation_code: "status_transition",
          outcome_code: "stale_revision",
          revision: 3,
          status: "in_progress",
          updated_at: updatedAt,
        },
      ],
    });
    await expect(
      transitionConsultationStatus(
        { query },
        {
          ...context,
          consultationId,
          expectedRevision: 1,
          idempotencyKey,
          newStatus: "cancelled",
          reasonCode: "CONSULTATION_CANCELLED",
        },
      ),
    ).resolves.toEqual({
      conflict: {
        changedFields: ["status", "consultation_revision"],
        currentRevision: 3,
        currentStatus: "in-progress",
        operationCode: "status_transition",
        updatedAt,
      },
      outcome: "stale_revision",
    });
  });
});
