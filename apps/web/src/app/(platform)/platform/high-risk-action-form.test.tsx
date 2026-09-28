import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HighRiskActionForm } from "./high-risk-action-form";

describe("HighRiskActionForm", () => {
  it("requires a controlled reason and explicit confirmation", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <HighRiskActionForm
        action={action}
        confirmation="This action revokes access."
        label="Deactivate platform user"
        target="opaque-user"
      >
        <input name="action" type="hidden" value="deactivate" />
      </HighRiskActionForm>,
    );

    const opener = screen.getByRole("button", { name: "Deactivate platform user" });
    await user.click(opener);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Deactivate platform user: opaque-user" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Controlled reason")).toBeRequired();
    expect(screen.getByRole("checkbox")).toBeRequired();
    expect(
      screen.getAllByRole("button", { name: "Deactivate platform user" }).at(-1),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });
});
