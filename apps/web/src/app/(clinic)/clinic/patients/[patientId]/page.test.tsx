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
  readPatientProfile: vi.fn(),
}));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("@graftvision/database", () => database);
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("../../../../session-activity-boundary", () => ({
  SessionActivityBoundary: ({ children }: { readonly children: React.ReactNode }) => children,
}));

import PatientProfilePage from "./page";

const patientId = "44444444-4444-4444-8444-444444444444";

describe("patient profile shell", () => {
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
      id: "33333333-3333-4333-8333-333333333333",
      lastActivityAt: new Date("2026-07-29T00:00:00Z"),
    });
    database.createDatabasePool.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
    database.readPatientProfile.mockResolvedValue({
      profile: {
        id: patientId,
        maskedDateOfBirth: "1990",
        maskedEmail: "s•••@masked.invalid",
        maskedName: "S••••••••",
        maskedPhone: "•••••••••••67",
        patientNumber: "GV-000001",
        registeredAt: "2026-07-20T00:00:00Z",
        revision: 1,
        lifecycleRevision: 1,
        lifecycleState: "current",
        status: "active",
        updatedAt: "2026-07-21T00:00:00Z",
      },
      timeline: [
        {
          eventCode: "REGISTRATION_CREATED",
          label: "Registration details created",
          occurredAt: "2026-07-21T00:00:00Z",
          referenceId: "55555555-5555-4555-8555-555555555555",
        },
      ],
    });
  });

  it("renders a masked accessible summary, curated timeline, and honest placeholders", async () => {
    render(
      await PatientProfilePage({
        params: Promise.resolve({ patientId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("heading", { name: "Identity summary" })).toBeInTheDocument();
    expect(screen.getByText("S••••••••")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Curated patient timeline" })).toHaveTextContent(
      "Registration details created",
    );
    expect(screen.getByRole("link", { name: "Back to patient search" })).toHaveAttribute(
      "href",
      "/clinic/patients",
    );
    expect(screen.getByRole("link", { name: "Start a consultation draft" })).toHaveAttribute(
      "href",
      `/clinic/patients/${patientId}/consultations/new`,
    );
    expect(
      screen.getByText(/Treatment consent.*not available in this profile shell/iu),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic Patient|\+92300/iu)).not.toBeInTheDocument();
  });

  it("renders a safe permission-denied state without protected content", async () => {
    database.readPatientProfile.mockRejectedValue(new Error("raw database details"));
    render(
      await PatientProfilePage({
        params: Promise.resolve({ patientId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Patient profile unavailable")).toBeInTheDocument();
    expect(screen.queryByText("raw database details")).not.toBeInTheDocument();
    expect(screen.queryByText("S••••••••")).not.toBeInTheDocument();
  });
});
