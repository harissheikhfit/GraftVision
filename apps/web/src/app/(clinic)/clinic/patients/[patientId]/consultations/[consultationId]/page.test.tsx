import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  createRequestAuthClient: vi.fn(),
  getActiveApplicationSession: vi.fn(),
  getCurrentUser: vi.fn(),
  requireVerifiedAuthSession: vi.fn(),
}));
const database = vi.hoisted(() => ({
  createDatabasePool: vi.fn(),
  readClinicalHistorySummary: vi.fn(),
  readActiveDoctorPrivateNotes: vi.fn(),
  readConsultation: vi.fn(),
  readHairLossHistory: vi.fn(),
  readMedicalHistory: vi.fn(),
  readPatientProfile: vi.fn(),
  readPreliminaryAssessment: vi.fn(),
  getConsultationAnalyzerReadiness: vi.fn(),
  readLifecycleEvents: vi.fn(),
}));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("@graftvision/database", () => database);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../../../../session-activity-boundary", () => ({
  SessionActivityBoundary: ({ children }: { readonly children: React.ReactNode }) => children,
}));

import ConsultationWorkspacePage from "./page";

const patientId = "44444444-4444-4444-8444-444444444444";
const consultationId = "55555555-5555-4555-8555-555555555555";

describe("consultation workspace page", () => {
  beforeEach(() => {
    auth.createRequestAuthClient.mockResolvedValue({});
    auth.requireVerifiedAuthSession.mockResolvedValue(undefined);
    auth.getCurrentUser.mockResolvedValue({
      clinicId: "11111111-1111-4111-8111-111111111111",
      displayLabel: "Authenticated user",
      platformUserId: "22222222-2222-4222-8222-222222222222",
    });
    auth.getActiveApplicationSession.mockResolvedValue({
      authorityScope: "clinic",
      clinicId: "11111111-1111-4111-8111-111111111111",
      id: "33333333-3333-4333-8333-333333333333",
      lastActivityAt: new Date("2026-07-30T08:00:00Z"),
    });
    database.createDatabasePool.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
    database.readClinicalHistorySummary.mockResolvedValue(null);
    database.readActiveDoctorPrivateNotes.mockResolvedValue([]);
    database.readHairLossHistory.mockResolvedValue(null);
    database.readMedicalHistory.mockResolvedValue(null);
    database.readPreliminaryAssessment.mockResolvedValue(null);
    database.getConsultationAnalyzerReadiness.mockResolvedValue(null);
    database.readLifecycleEvents.mockResolvedValue([]);
    database.readConsultation.mockResolvedValue({
      assignedDoctorPlatformUserId: null,
      createdAt: new Date("2026-07-30T08:00:00Z"),
      id: consultationId,
      patientId,
      revision: 1,
      status: "draft",
      updatedAt: new Date("2026-07-30T08:00:00Z"),
    });
    database.readPatientProfile.mockResolvedValue({
      profile: {
        id: patientId,
        lifecycleRevision: 1,
        lifecycleState: "current",
        maskedDateOfBirth: "1990",
        maskedEmail: "s•••@masked.invalid",
        maskedName: "S••••••••",
        maskedPhone: "•••••••••••67",
        patientNumber: "GV-000001",
        registeredAt: "2026-07-20T00:00:00Z",
        revision: 1,
        status: "active",
        updatedAt: "2026-07-21T00:00:00Z",
      },
      timeline: [],
    });
  });

  it("opens a same-patient consultation and reports a newly persisted draft", async () => {
    render(
      await ConsultationWorkspacePage({
        params: Promise.resolve({ consultationId, patientId }),
        searchParams: Promise.resolve({ created: "true" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Consultation workspace" })).toBeInTheDocument();
    expect(screen.getByText("Consultation draft created")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to patient profile" })).toHaveAttribute(
      "href",
      `/clinic/patients/${patientId}`,
    );
  });

  it("returns a safe not-found/denied state for a mismatched patient route", async () => {
    database.readConsultation.mockResolvedValue({
      ...(await database.readConsultation()),
      patientId: "99999999-9999-4999-8999-999999999999",
    });
    render(
      await ConsultationWorkspacePage({
        params: Promise.resolve({ consultationId, patientId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Consultation unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/99999999|database/iu)).not.toBeInTheDocument();
  });
});
