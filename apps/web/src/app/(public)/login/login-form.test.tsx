import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renders accessible email and password fields with correct attributes", () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/Email/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("autoComplete", "username");

    const passwordInput = screen.getByLabelText(/Password/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autoComplete", "current-password");
  });

  it("renders a submit button and no extra unauthorized links", () => {
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /Sign in/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");

    expect(screen.queryByText(/Sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clinic/i, { selector: "button, a" })).not.toBeInTheDocument();
    expect(screen.queryByText(/patient/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="scope"]')).not.toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).not.toBeInTheDocument();
  });

  it("displays generic action error without provider details on submit", () => {
    render(<LoginForm initialState={{ message: "Generic synthetic error" }} />);

    expect(screen.getByText("Generic synthetic error")).toBeInTheDocument();
  });
});
