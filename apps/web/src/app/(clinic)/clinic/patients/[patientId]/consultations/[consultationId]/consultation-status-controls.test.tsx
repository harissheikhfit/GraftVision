import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConsultationStatusControls } from "./consultation-status-controls";

describe("consultation status controls", () => {
  it("moves focus to the privacy-safe conflict heading and requires an explicit reload", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ status: "conflict" });
    render(
      <ConsultationStatusControls
        reloadHref="/clinic/patients/patient/consultations/consultation"
        startAction={action}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));

    const heading = await screen.findByRole("heading", { name: "Consultation changed" });
    expect(heading).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This consultation was updated after you opened it. Reload the latest version before trying again.",
    );
    expect(screen.getByRole("link", { name: "Reload latest version" })).toHaveAttribute(
      "href",
      "/clinic/patients/patient/consultations/consultation",
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("renders only the approved draft preparation and cancellation actions", () => {
    const action = vi.fn().mockResolvedValue({});
    render(
      <ConsultationStatusControls
        cancelAction={action}
        reloadHref="/clinic/patients/patient/consultations/consultation"
        startAction={action}
      />,
    );
    expect(screen.getByRole("button", { name: "Start preparation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel consultation" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /capture|complete|review/iu })).toBeNull();
  });
});
