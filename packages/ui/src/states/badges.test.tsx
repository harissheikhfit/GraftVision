import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIAssistedBadge } from "./ai-assisted-badge";
import { ApprovalBadge } from "./approval-badge";
import { PatientSafeBadge } from "./patient-safe-badge";
import { PrivacyBadge } from "./privacy-badge";
import { RestrictedBadge } from "./restricted-badge";
import { StatusBadge } from "./status-badge";

describe("state badges", () => {
  it("shows required status labels, semantic variants, and non-colour cues", () => {
    const { container } = render(
      <StatusBadge icon={<span>custom</span>} label="Review required" variant="review-required" />,
    );

    const badge = screen.getByText("Review required").closest(".gv-state-badge");
    const cue = container.querySelector(".gv-state-badge__cue");

    expect(badge).toHaveAttribute("data-tone", "preliminary");
    expect(cue).toHaveAttribute("aria-hidden", "true");
    expect(cue).toHaveTextContent("custom");
  });

  it("rejects an empty status label", () => {
    expect(() => render(<StatusBadge label=" " />)).toThrow(/non-empty text label/);
  });

  it("uses protected privacy labels in compact and described forms", () => {
    const { rerender } = render(
      <PrivacyBadge
        description="Only approved viewers may use this content."
        variant="doctor-only"
      />,
    );

    expect(screen.getByText("Doctor only").closest(".gv-state-badge")).toHaveAttribute(
      "aria-description",
      "Only approved viewers may use this content.",
    );

    rerender(<PrivacyBadge compact variant="approved-for-sharing" />);
    expect(screen.getByText("Shareable")).toBeInTheDocument();
  });

  it("keeps doctor approval explicit and only displays supplied attribution", () => {
    const { rerender } = render(
      <ApprovalBadge
        approvedBy="Authorised reviewer"
        variant="doctor-approved"
        versionLabel="v2"
      />,
    );

    expect(screen.getByText(/Doctor approved — v2, approved by Authorised reviewer/)).toBeVisible();

    rerender(<ApprovalBadge variant="draft" />);
    expect(screen.getByText("Draft")).not.toHaveTextContent("approved by");
  });

  it("always identifies AI assistance without implying approval", () => {
    render(<AIAssistedBadge confidence="Moderate confidence" uncertain />);

    const badge = screen.getByText(/AI-assisted/);
    expect(badge).toHaveTextContent("Moderate confidence");
    expect(badge).toHaveTextContent("uncertainty noted");
    expect(badge).not.toHaveTextContent("approved");
  });

  it("keeps patient-safe and restricted meanings explicit", () => {
    render(
      <>
        <PatientSafeBadge />
        <RestrictedBadge reason="Additional access is required" />
      </>,
    );

    expect(screen.getByText("Patient safe")).not.toHaveTextContent("approved");
    expect(screen.getByText(/Restricted — Additional access is required/)).toBeVisible();
  });
});
