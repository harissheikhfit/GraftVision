import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClinicSettingsForm } from "./clinic-settings-form";

vi.mock("./actions", () => ({
  updateClinicSettingsAction: vi.fn(() => Promise.resolve({ status: "success" })),
}));

describe("ClinicSettingsForm", () => {
  it("renders bounded labelled controls and an immutable clinic code", async () => {
    const user = userEvent.setup();
    render(
      <ClinicSettingsForm
        clinicCode="face-lahore"
        displayName="FACE Aesthetic Clinic Lahore"
        revision={2}
        timezone="Asia/Karachi"
      />,
    );
    expect(screen.getByRole("textbox", { name: "Clinic code" })).toHaveAttribute("readonly");
    const name = screen.getByRole("textbox", { name: /^Clinic display name/u });
    const timezone = screen.getByRole("combobox", { name: /^Timezone/u });
    await user.clear(name);
    await user.type(name, "FACE Clinic Lahore");
    await user.selectOptions(timezone, "Asia/Dubai");
    expect(name).toHaveValue("FACE Clinic Lahore");
    expect(timezone).toHaveValue("Asia/Dubai");
    expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled();
  });

  it("does not expose arbitrary settings fields", () => {
    render(
      <ClinicSettingsForm
        clinicCode="face-lahore"
        displayName="FACE Aesthetic Clinic Lahore"
        revision={1}
        timezone="Asia/Karachi"
      />,
    );
    expect(screen.queryByLabelText(/logo|branding|phone|address|billing|protocol/iu)).toBeNull();
  });
});
