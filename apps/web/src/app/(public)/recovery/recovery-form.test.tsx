import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecoveryForm } from "./recovery-form";

describe("RecoveryForm", () => {
  it("renders accessible email field with correct attributes", () => {
    render(<RecoveryForm />);

    const emailInput = screen.getByLabelText(/Email/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("autoComplete", "username");
  });

  it("renders a submit button", () => {
    render(<RecoveryForm />);

    const submitButton = screen.getByRole("button", { name: /Send reset link/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("displays generic action error on submit", () => {
    render(<RecoveryForm initialState={{ message: "Generic synthetic error" }} />);

    expect(screen.getByText("Generic synthetic error")).toBeInTheDocument();
  });
});
