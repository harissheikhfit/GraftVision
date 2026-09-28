import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PresentationShell } from "./presentation-shell";
import { PresentationStage } from "./presentation-stage";
import { ScanShell } from "./scan-shell";
import { SessionContextBar } from "./session-context-bar";

describe("specialized shells", () => {
  it("keeps scan controls in dedicated mobile shell regions", () => {
    render(
      <ScanShell
        bottomAction={<button type="button">Continue</button>}
        connectivity={<SessionContextBar state="offline" />}
        progress="Step foundation"
        stepTitle={<h1>Scan shell</h1>}
      >
        Capture placeholder
      </ScanShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Capture placeholder");
    expect(main.querySelector(".gv-scan-shell__work-region")).toBeInTheDocument();
    expect(main.querySelector(".gv-scan-shell__progress")).toHaveTextContent("Step foundation");
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders patient-safe presentation structure without internal navigation", () => {
    const { container } = render(
      <PresentationShell
        footerControls={<span>Reserved doctor-control slot</span>}
        footerMarker="Safe display marker"
      >
        <PresentationStage
          mainVisual="Reserved visual area"
          supporting="No patient data loaded."
          title="Presentation shell"
        />
      </PresentationShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Presentation shell" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Patient safe")).toBeInTheDocument();
    expect(screen.getByText("Safe display marker")).toBeInTheDocument();
    expect(screen.getByText("Reserved doctor-control slot")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".gv-app-shell--presentation")).toBeInTheDocument();
  });

  it("labels temporary presentation mode without introducing session data", () => {
    render(
      <PresentationShell sessionMode>
        <PresentationStage title="Temporary shell" />
      </PresentationShell>,
    );

    expect(screen.getByText("Temporary presentation")).toBeInTheDocument();
    expect(screen.queryByText(/patient record/i)).not.toBeInTheDocument();
  });
});
