import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { clinicBrandDefaultAccentValues } from "@graftvision/ui";

import { ClinicBrandingForm } from "./clinic-branding-form";

vi.mock("./actions", () => ({
  updateClinicBrandingAction: vi.fn(() => Promise.resolve({ status: "success" })),
}));

const props = {
  brandingRevision: 2,
  clinicName: "FACE Aesthetic Clinic Lahore",
  linkAccent: clinicBrandDefaultAccentValues.link,
  logoHeight: null,
  logoUrl: null,
  logoWidth: null,
  presentationTitleText: "FACE Consultation",
  primaryAccent: clinicBrandDefaultAccentValues.primary,
  reportHeaderText: "FACE Hair Restoration Report",
  secondaryAccent: clinicBrandDefaultAccentValues.secondary,
  selectedControlAccent: clinicBrandDefaultAccentValues.selectedControl,
};

describe("ClinicBrandingForm", () => {
  it("renders the bounded controls and all three accessible visual previews", async () => {
    const user = userEvent.setup();
    render(<ClinicBrandingForm {...props} />);
    const clinicName = screen.getByRole("textbox", { name: /^Clinic name/u });
    await user.clear(clinicName);
    await user.type(clinicName, "FACE Clinic");
    expect(screen.getByRole("region", { name: "Clinic shell preview" })).toHaveTextContent(
      "FACE Clinic",
    );
    expect(screen.getByRole("region", { name: "Report header preview" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Presentation title preview" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save branding" })).toBeEnabled();
  });

  it("limits logo selection and exposes an accessible default-brand fallback", () => {
    render(<ClinicBrandingForm {...props} />);
    expect(screen.getByLabelText("Clinic logo")).toHaveAttribute(
      "accept",
      "image/png,image/jpeg,image/webp,image/svg+xml",
    );
    expect(screen.getByText("Default GraftVision branding is currently used.")).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: "Remove current logo and use GraftVision default",
      }),
    ).toBeEnabled();
  });

  it("does not expose arbitrary theme or workflow controls", () => {
    render(<ClinicBrandingForm {...props} />);
    expect(screen.queryByLabelText(/css|font|gradient|layout|theme json/iu)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /generate report|start presentation/iu }),
    ).toBeNull();
  });
});
