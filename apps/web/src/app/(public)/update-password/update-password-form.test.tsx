import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UpdatePasswordForm } from "./update-password-form";

describe("UpdatePasswordForm", () => {
  it("renders accessible password field with correct attributes", () => {
    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/New password/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autoComplete", "new-password");
  });

  it("renders a submit button", () => {
    render(<UpdatePasswordForm />);

    const submitButton = screen.getByRole("button", { name: /Update password/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("displays generic action error on submit", () => {
    render(<UpdatePasswordForm initialState={{ message: "Generic synthetic error" }} />);

    expect(screen.getByText("Generic synthetic error")).toBeInTheDocument();
  });
});
