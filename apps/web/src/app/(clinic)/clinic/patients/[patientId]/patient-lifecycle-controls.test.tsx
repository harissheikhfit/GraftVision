import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PatientLifecycleControls } from "./patient-lifecycle-controls";

vi.mock("./lifecycle-actions", () => ({
  archivePatientAction: vi.fn(),
  restorePatientAction: vi.fn(),
}));

describe("patient lifecycle controls", () => {
  it("renders an explicit keyboard-accessible archive confirmation", async () => {
    const user = userEvent.setup();
    render(
      <PatientLifecycleControls
        lifecycleRevision={1}
        lifecycleState="current"
        patientId="11111111-1111-4111-8111-111111111111"
      />,
    );
    const reason = screen.getByRole("combobox", { name: "Archive reason" });
    await user.selectOptions(reason, "administrative_cleanup");
    const confirmation = screen.getByRole("checkbox", {
      name: /confirm this reversible lifecycle change/iu,
    });
    await user.click(confirmation);
    expect(reason).toHaveValue("administrative_cleanup");
    expect(confirmation).toBeChecked();
    expect(screen.getByRole("button", { name: "Archive patient" })).toBeEnabled();
  });

  it("renders controlled restore reasons without free text", () => {
    render(
      <PatientLifecycleControls
        lifecycleRevision={2}
        lifecycleState="archived"
        patientId="11111111-1111-4111-8111-111111111111"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Restore reason" })).toBeRequired();
    expect(screen.getByRole("option", { name: "Patient returned" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
