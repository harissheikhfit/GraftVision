import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  getActiveApplicationSession: vi.fn(),
  getCurrentUser: vi.fn(),
  requireVerifiedAuthSession: vi.fn(),
}));
const database = vi.hoisted(() => ({
  createConsultation: vi.fn(),
  createDatabasePool: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("@graftvision/database", () => database);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => navigation);

import { createConsultationAction } from "./actions";

const context = {
  idempotencyKey: "44444444-4444-4444-8444-444444444444",
  patientId: "33333333-3333-4333-8333-333333333333",
};

describe("consultation creation Server Action", () => {
  beforeEach(() => {
    auth.createRequestAuthClient.mockResolvedValue({});
    auth.requireVerifiedAuthSession.mockResolvedValue(undefined);
    auth.getCurrentUser.mockResolvedValue({
      clinicId: "11111111-1111-4111-8111-111111111111",
      platformUserId: "22222222-2222-4222-8222-222222222222",
    });
    auth.getActiveApplicationSession.mockResolvedValue({
      authorityScope: "clinic",
      clinicId: "11111111-1111-4111-8111-111111111111",
      id: "55555555-5555-4555-8555-555555555555",
    });
    database.createDatabasePool.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
    database.createConsultation.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
    });
    navigation.redirect.mockImplementation(() => {
      throw Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;replace" });
    });
  });

  it("passes only server-bound identifiers and trusted session context", async () => {
    await expect(createConsultationAction(context, {}, new FormData())).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace",
    });
    expect(database.createConsultation).toHaveBeenCalledWith(expect.anything(), {
      applicationSessionId: "55555555-5555-4555-8555-555555555555",
      idempotencyKey: context.idempotencyKey,
      patientId: context.patientId,
      providerIdentityId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("denies mismatched scope without exposing protected detail", async () => {
    auth.getActiveApplicationSession.mockResolvedValue({
      authorityScope: "platform",
      clinicId: null,
    });
    await expect(createConsultationAction(context, {}, new FormData())).resolves.toEqual({
      message: "The consultation draft could not be created.",
      status: "error",
    });
    expect(database.createConsultation).not.toHaveBeenCalled();
  });
});
