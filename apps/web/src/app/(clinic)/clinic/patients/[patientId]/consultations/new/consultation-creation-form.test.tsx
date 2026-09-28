import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConsultationCreationForm } from "./consultation-creation-form";

describe("consultation creation form", () => {
  it("describes the unassigned draft and remains keyboard operable", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({});
    render(<ConsultationCreationForm action={action} />);

    expect(screen.getByText(/creates an unassigned draft/iu)).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Create consultation draft" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("announces a privacy-safe creation error", () => {
    const action = vi.fn().mockResolvedValue({
      message: "The consultation draft could not be created.",
      status: "error",
    });
    render(<ConsultationCreationForm action={action} />);
    expect(screen.queryByText(/database|patient identity|token/iu)).not.toBeInTheDocument();
  });
});
