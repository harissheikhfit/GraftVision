import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClinicOnboardingForm } from "./clinic-onboarding-form";

vi.mock("./actions", () => ({
  attestClinicOnboardingAction: vi.fn().mockResolvedValue({
    message: "Readiness attestation updated.",
    status: "success",
  }),
}));

describe("ClinicOnboardingForm", () => {
  it("exposes explicit accessible attestation actions", () => {
    render(
      <ClinicOnboardingForm
        attestation={{ expiresAt: null, revision: 0, status: "missing" }}
        attestationCode="SECURITY_READY"
        label="Security readiness"
      />,
    );
    expect(screen.getByText(/current status:/i)).toHaveTextContent("missing");
    expect(screen.getByLabelText("Optional expiry")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByRole("button", { name: "Attest ready" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Withdraw attestation" })).toBeEnabled();
  });

  it("supports keyboard focus order", async () => {
    const user = userEvent.setup();
    render(
      <ClinicOnboardingForm
        attestation={{ expiresAt: null, revision: 1, status: "attested" }}
        attestationCode="PROTOCOL_TEMPLATE_READY"
        label="Protocol readiness"
      />,
    );
    await user.tab();
    expect(screen.getByLabelText("Optional expiry")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Attest ready" })).toHaveFocus();
  });
});
