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
  searchPatients: vi.fn(),
}));

vi.mock("@graftvision/auth/server", () => auth);
vi.mock("@graftvision/database", () => database);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../session-activity-boundary", () => ({
  SessionActivityBoundary: ({ children }: { readonly children: React.ReactNode }) => children,
}));

import PatientListPage from "./page";

describe("patient list/search page", () => {
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
    database.searchPatients.mockResolvedValue({
      nextCursor: "next",
      patients: [
        {
          createdAt: "2026-07-29T00:00:00Z",
          hasEmail: true,
          hasPhone: true,
          id: "44444444-4444-4444-8444-444444444444",
          maskedName: "S••••••••",
          patientNumber: "GV-000001",
          revision: 1,
          status: "active",
        },
      ],
      previousCursor: null,
    });
  });

  it("renders accessible filters, masked results, and cursor navigation", async () => {
    render(await PatientListPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Patient search results" })).toHaveTextContent(
      "S••••••••",
    );
    expect(screen.getByRole("navigation", { name: "Patient result pages" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GV-000001" })).toHaveAttribute(
      "href",
      "/clinic/patients/44444444-4444-4444-8444-444444444444",
    );
    expect(screen.queryByText(/synthetic@example|\+92300/iu)).not.toBeInTheDocument();
  });

  it("shows a privacy-safe denial state without protected results", async () => {
    database.searchPatients.mockRejectedValue(new Error("sensitive internal error"));
    render(await PatientListPage({ searchParams: Promise.resolve({ query: "private value" }) }));
    expect(screen.getByText("Patient search unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Patient search results" })).not.toBeInTheDocument();
    expect(screen.queryByText("sensitive internal error")).not.toBeInTheDocument();
  });
});
