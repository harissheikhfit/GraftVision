import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LockedSessionContent } from "./locked-session-content";

describe("LockedSessionContent", () => {
  it("renders only privacy-safe lock content with accessible reauthentication controls", () => {
    const { container } = render(
      <LockedSessionContent logoutAction={vi.fn()} unlockAction={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Shared device locked" })).toBeVisible();
    expect(screen.getByLabelText(/Password/iu)).toHaveFocus();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign out instead" })).toBeEnabled();
    expect(container).not.toHaveTextContent(/clinic|patient|role|permission|verification/iu);
    expect(container.querySelector('input[type="password"]')).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });
});
