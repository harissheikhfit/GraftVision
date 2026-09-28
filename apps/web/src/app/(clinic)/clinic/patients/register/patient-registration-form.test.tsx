import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PatientRegistrationForm } from "./patient-registration-form";

vi.mock("./actions", () => ({
  registerPatientAction: vi.fn().mockResolvedValue({
    message: "Patient registration created.",
    patientNumber: "GV-000001",
    status: "success",
  }),
}));

describe("PatientRegistrationForm", () => {
  it("renders only the approved accessible registration fields", () => {
    render(<PatientRegistrationForm idempotencyKey="44444444-4444-4444-8444-444444444444" />);
    expect(screen.getByLabelText(/^Full name/iu)).toBeRequired();
    expect(screen.getByLabelText(/^Date of birth/iu)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/^Phone/iu)).toHaveAttribute("inputmode", "tel");
    expect(screen.getByLabelText(/^Email/iu)).toHaveAttribute("type", "email");
    expect(screen.queryByLabelText(/CNIC|national|gender|sex/iu)).not.toBeInTheDocument();
  });

  it("supports keyboard-only registration", async () => {
    const user = userEvent.setup();
    render(<PatientRegistrationForm idempotencyKey="44444444-4444-4444-8444-444444444444" />);
    await user.tab();
    expect(screen.getByLabelText(/^Full name/iu)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/^Date of birth/iu)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/^Phone/iu)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/^Email/iu)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Check and register" })).toHaveFocus();
  });
});
