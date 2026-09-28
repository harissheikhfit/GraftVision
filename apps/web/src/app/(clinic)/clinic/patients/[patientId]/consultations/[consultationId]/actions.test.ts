import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  getActiveApplicationSession: vi.fn(),
  getCurrentUser: vi.fn(),
  requireVerifiedAuthSession: vi.fn(),
}));
const database = vi.hoisted(() => ({
  createDatabasePool: vi.fn(),
  transitionConsultationStatus: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("@graftvision/database", () => database);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => navigation);

import { transitionConsultationStatusAction } from "./actions";

const context = {
  consultationId: "55555555-5555-4555-8555-555555555555",
  expectedRevision: 1,
  idempotencyKey: "66666666-6666-4666-8666-666666666666",
  newStatus: "in-progress" as const,
  patientId: "44444444-4444-4444-8444-444444444444",
  reasonCode: "PREPARATION_STARTED" as const,
};

describe("consultation status action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.createRequestAuthClient.mockResolvedValue({});
    auth.requireVerifiedAuthSession.mockResolvedValue(undefined);
    auth.getCurrentUser.mockResolvedValue({
      clinicId: "11111111-1111-4111-8111-111111111111",
      platformUserId: "22222222-2222-4222-8222-222222222222",
    });
    auth.getActiveApplicationSession.mockResolvedValue({
      authorityScope: "clinic",
      clinicId: "11111111-1111-4111-8111-111111111111",
      id: "33333333-3333-4333-8333-333333333333",
    });
    database.createDatabasePool.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
  });

  it("returns the controlled conflict state without redirecting or exposing values", async () => {
    database.transitionConsultationStatus.mockResolvedValue({
      conflict: {
        changedFields: ["status", "consultation_revision"],
        currentRevision: 2,
        currentStatus: "in-progress",
        operationCode: "status_transition",
        updatedAt: new Date(),
      },
      outcome: "stale_revision",
    });
    await expect(transitionConsultationStatusAction(context, {}, new FormData())).resolves.toEqual({
      status: "conflict",
    });
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("preserves safe denial when the session is not in the trusted clinic context", async () => {
    auth.getActiveApplicationSession.mockResolvedValue({
      authorityScope: "platform",
      clinicId: null,
      id: "33333333-3333-4333-8333-333333333333",
    });
    await expect(transitionConsultationStatusAction(context, {}, new FormData())).resolves.toEqual({
      status: "error",
    });
    expect(database.transitionConsultationStatus).not.toHaveBeenCalled();
  });
});
