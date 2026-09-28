import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsultationWorkspace } from "./consultation-workspace";

const consultation = {
  assignedDoctorPlatformUserId: null,
  createdAt: new Date("2026-07-30T08:00:00Z"),
  id: "55555555-5555-4555-8555-555555555555",
  patientId: "44444444-4444-4444-8444-444444444444",
  revision: 1,
  status: "draft" as const,
  updatedAt: new Date("2026-07-30T08:00:00Z"),
};
const patient = {
  id: consultation.patientId,
  lifecycleRevision: 1,
  lifecycleState: "current" as const,
  maskedDateOfBirth: "1990",
  maskedEmail: "s•••@masked.invalid",
  maskedName: "S••••••••",
  maskedPhone: "•••••••••••67",
  patientNumber: "GV-000001",
  registeredAt: "2026-07-20T00:00:00Z",
  revision: 1,
  status: "active" as const,
  updatedAt: "2026-07-21T00:00:00Z",
};

describe("consultation workspace", () => {
  it("renders masked sticky context, unassigned state, and persisted save language", () => {
    render(
      <ConsultationWorkspace
        consultation={consultation}
        patient={patient}
        reloadHref={`/clinic/patients/${patient.id}/consultations/${consultation.id}`}
        viewerLabel="Authenticated user"
      />,
    );
    expect(screen.getByLabelText("Masked patient context")).toHaveTextContent("S••••••••");
    expect(screen.getAllByText("No Doctor assigned").length).toBeGreaterThan(0);
    expect(screen.getByText("Persisted revision").closest("div")).toHaveTextContent("1");
    expect(screen.getByText("Saved to GraftVision")).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic Patient|\+92300/iu)).not.toBeInTheDocument();
  });

  it("renders an informational workflow rail without enabled transitions", () => {
    render(
      <ConsultationWorkspace
        consultation={consultation}
        patient={patient}
        reloadHref={`/clinic/patients/${patient.id}/consultations/${consultation.id}`}
        viewerLabel="Authenticated user"
      />,
    );
    const rail = screen.getByRole("list", { name: "Consultation workflow" });
    expect(rail).toHaveTextContent("Draft — current");
    expect(rail).toHaveTextContent("Capture complete — unavailable");
    expect(screen.getByText(/rail is informational/iu)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /capture complete|completed/iu })).toBeNull();
  });

  it("keeps assignment and later clinical modules visibly disabled", () => {
    render(
      <ConsultationWorkspace
        consultation={consultation}
        patient={patient}
        reloadHref={`/clinic/patients/${patient.id}/consultations/${consultation.id}`}
        viewerLabel="Authenticated user"
      />,
    );
    expect(screen.getByRole("button", { name: "Assign Doctor" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Not available" })).toHaveLength(4);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByText(/Camera capture, uploads, LiDAR/iu)).toBeInTheDocument();
    expect(screen.getAllByText(/Doctor approval/iu).length).toBeGreaterThan(0);
  });
});
