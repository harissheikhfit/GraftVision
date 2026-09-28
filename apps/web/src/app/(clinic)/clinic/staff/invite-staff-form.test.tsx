import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InviteStaffForm } from "./invite-staff-form";

vi.mock("./actions", () => ({
  inviteStaffAction: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("InviteStaffForm", () => {
  it("provides labelled keyboard-operable controls for ordinary clinic staff roles", async () => {
    const user = userEvent.setup();
    render(<InviteStaffForm canManageHighRiskRoles={false} />);

    const email = screen.getByRole("textbox", { name: /^Email/u });
    const role = screen.getByRole("combobox", { name: /^Clinic role/u });
    await user.type(email, "staff@fixtures.example.test");
    await user.selectOptions(role, "RECEPTION");

    expect(email).toHaveValue("staff@fixtures.example.test");
    expect(role).toHaveValue("RECEPTION");
    expect(screen.getByRole("button", { name: "Invite staff member" })).toBeEnabled();
    expect(screen.queryByRole("option", { name: "Doctor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Clinic Owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Clinic Administrator" })).not.toBeInTheDocument();
  });

  it("shows approved high-risk clinic roles only to Clinic Owners", () => {
    render(<InviteStaffForm canManageHighRiskRoles />);

    expect(screen.getByRole("option", { name: "Doctor" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Clinic Owner" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Clinic Administrator" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Patient" })).not.toBeInTheDocument();
  });
});
