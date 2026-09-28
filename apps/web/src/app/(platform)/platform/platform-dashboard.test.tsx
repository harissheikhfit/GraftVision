import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { maskReference, PlatformDashboardView } from "./platform-dashboard";

const clinicAction = vi.fn();
const operationalAction = vi.fn();
const clinicAId = "51000000-0000-4000-8000-000000000001";
const clinicBId = "51000000-0000-4000-8000-000000000002";
const userId = "20000000-0000-4000-8000-000000000001";
const sessionId = "30000000-0000-4000-8000-000000000001";

const props = {
  audit: [
    {
      action: "clinic.create",
      actorReference: userId,
      auditScope: "platform",
      authorizationRevision: 1,
      clinicReference: clinicAId,
      id: "40000000-0000-4000-8000-000000000001",
      occurredAt: "2026-07-29T10:00:00.000Z",
      outcome: "success",
      reasonCode: null,
    },
  ],
  clinicAction,
  dashboard: {
    activeClinics: 1,
    clinics: [
      {
        administrators: 1,
        clinicCode: "FACE-LHR",
        displayName: "FACE Aesthetic Clinic Lahore",
        id: clinicAId,
        readinessRevision: 2,
        readinessState: "ready",
        revision: 3,
        status: "active" as const,
        timezone: "Asia/Karachi",
      },
      {
        administrators: 0,
        clinicCode: "TEST-ISB",
        displayName: "Synthetic Islamabad Clinic",
        id: clinicBId,
        readinessRevision: 1,
        readinessState: "not_ready",
        revision: 1,
        status: "suspended" as const,
        timezone: "Asia/Karachi",
      },
    ],
    inactiveClinics: 0,
    notReadyClinics: 1,
    readyClinics: 1,
    suspendedClinics: 1,
    totalClinics: 2,
  },
  operationalAction,
  sessionHealth: {
    activeCount: 1,
    expiredCount: 0,
    lockedCount: 0,
    revokedCount: 0,
    sessions: [
      {
        createdAt: "2026-07-29T09:00:00.000Z",
        expiresAt: "2026-07-29T17:00:00.000Z",
        id: sessionId,
        lastActivityAt: "2026-07-29T10:00:00.000Z",
        platformUserId: userId,
        revokedAt: null,
        scope: "platform" as const,
        status: "active" as const,
      },
    ],
    staleCount: 0,
    users: [
      {
        authorizationVersion: 1,
        id: userId,
        platformRoles: ["PLATFORM_OWNER"],
        status: "active" as const,
      },
    ],
  },
};

describe("PlatformDashboardView", () => {
  it("renders operational sections and masks opaque security references", () => {
    render(<PlatformDashboardView {...props} />);

    expect(screen.getByRole("heading", { name: "Operational summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clinics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform sessions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent platform audit" })).toBeInTheDocument();
    expect(screen.queryByText(userId)).not.toBeInTheDocument();
    expect(screen.queryByText(sessionId)).not.toBeInTheDocument();
    expect(screen.getAllByText(maskReference(userId)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Revoke sessions" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeEnabled();
  });

  it("filters clinics by name and lifecycle without changing authority data", async () => {
    const user = userEvent.setup();
    render(<PlatformDashboardView {...props} />);

    await user.type(screen.getByRole("searchbox", { name: "Search clinics" }), "face");
    expect(screen.getByText("FACE Aesthetic Clinic Lahore")).toBeInTheDocument();
    expect(screen.queryByText("Synthetic Islamabad Clinic")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search clinics" }));
    await user.selectOptions(screen.getByLabelText("Lifecycle status"), "suspended");
    expect(screen.queryByText("FACE Aesthetic Clinic Lahore")).not.toBeInTheDocument();
    expect(screen.getByText("Synthetic Islamabad Clinic")).toBeInTheDocument();
  });

  it("provides labelled create controls and controlled clinic actions", async () => {
    const user = userEvent.setup();
    render(<PlatformDashboardView {...props} />);

    expect(screen.getByLabelText(/Clinic code/)).toBeRequired();
    expect(screen.getAllByLabelText(/Clinic name/).at(-1)).toBeRequired();
    expect(screen.getAllByLabelText(/Timezone/).at(-1)).toBeRequired();
    expect(screen.getByRole("button", { name: "Create clinic" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Clinic code/), "new-lhr");
    await user.type(screen.getAllByLabelText(/Clinic name/).at(-1)!, "New Lahore Clinic");
    expect(screen.getByRole("button", { name: "Create clinic" })).toBeEnabled();

    const clinic = screen.getByText("FACE Aesthetic Clinic Lahore").closest("article");
    expect(clinic).not.toBeNull();
    await user.click(within(clinic!).getByText("Manage clinic"));
    expect(within(clinic!).getByRole("button", { name: "Save clinic details" })).toBeEnabled();
    expect(within(clinic!).getByRole("button", { name: "Suspend clinic" })).toBeEnabled();
    expect(within(clinic!).getByRole("button", { name: "Assign administrator" })).toBeEnabled();
  });

  it("shows friendly audit labels without raw audit metadata", () => {
    render(<PlatformDashboardView {...props} />);

    expect(screen.getByRole("heading", { name: "Clinic created" })).toBeInTheDocument();
    expect(screen.queryByText("clinic.create")).not.toBeInTheDocument();
    expect(screen.queryByText(clinicAId)).not.toBeInTheDocument();
    expect(screen.queryByText("authorizationRevision")).not.toBeInTheDocument();
  });

  it("does not render patient or clinical records", () => {
    render(<PlatformDashboardView {...props} />);

    expect(screen.queryByText(/patient data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clinical record/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/consultation/i)).not.toBeInTheDocument();
  });

  it("renders safe empty states", () => {
    render(
      <PlatformDashboardView
        {...props}
        audit={[]}
        dashboard={{ ...props.dashboard, clinics: [] }}
        sessionHealth={{ ...props.sessionHealth, sessions: [], users: [] }}
      />,
    );

    expect(screen.getByRole("heading", { name: "No clinics match this view" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No platform users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No sessions in this view" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No audit events in this view" }),
    ).toBeInTheDocument();
  });
});
