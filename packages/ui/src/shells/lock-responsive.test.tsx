import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";
import { PresentationShell } from "./presentation-shell";
import { ResponsiveShellRegion } from "./responsive-shell-region";
import { SharedDeviceIndicator } from "./shared-device-indicator";
import { ShellLockLayer } from "./shell-lock-layer";
import { ShellOverlayRegion } from "./shell-overlay-region";

describe("shell safety and responsive readiness", () => {
  it("makes locked shell content inert and exposes only the lock layer", () => {
    const { container } = render(
      <AppShell
        locked
        lockLayer={
          <ShellLockLayer
            description="Return this shared device before continuing."
            mode="shared-device"
          />
        }
        variant="clinic"
      >
        <button type="button">Protected action</button>
      </AppShell>,
    );

    const frame = container.querySelector(".gv-app-shell__frame");
    expect(frame).toHaveAttribute("inert");
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText("Secure lock layer")).toHaveAttribute(
      "data-lock-mode",
      "shared-device",
    );
  });

  it("maps responsive intent to declarative CSS hooks", () => {
    render(
      <>
        <ResponsiveShellRegion visibility="mobile">Mobile region</ResponsiveShellRegion>
        <ResponsiveShellRegion visibility="desktop">Desktop region</ResponsiveShellRegion>
      </>,
    );

    expect(screen.getByText("Mobile region")).toHaveClass("gv-responsive-shell-region--mobile");
    expect(screen.getByText("Desktop region")).toHaveClass("gv-responsive-shell-region--desktop");
  });

  it("does not mount a closed overlay region", () => {
    const { rerender } = render(
      <ShellOverlayRegion label="Shell menu">Overlay content</ShellOverlayRegion>,
    );

    expect(screen.queryByLabelText("Shell menu")).not.toBeInTheDocument();

    rerender(
      <ShellOverlayRegion label="Shell menu" visible>
        Overlay content
      </ShellOverlayRegion>,
    );
    expect(screen.getByLabelText("Shell menu")).toHaveAttribute("data-overlay-visible", "true");
  });

  it("supports presentation lock mode with protected safe copy", () => {
    render(
      <PresentationShell
        locked
        lockLayer={
          <ShellLockLayer
            description="This presentation is no longer available."
            mode="presentation"
          />
        }
      >
        Hidden presentation
      </PresentationShell>,
    );

    expect(screen.getByLabelText("Secure lock layer")).toHaveAttribute(
      "data-lock-mode",
      "presentation",
    );
    expect(screen.getByText("This presentation is no longer available.")).toBeInTheDocument();
  });

  it("shows shared-device context without exposing identity by default", () => {
    render(<SharedDeviceIndicator description="Confirm the active user before continuing." />);

    expect(screen.getByLabelText("Shared-device context")).toHaveTextContent("Shared device");
    expect(screen.getByText("Confirm the active user before continuing.")).toBeInTheDocument();
    expect(screen.queryByText(/patient|clinic/i)).not.toBeInTheDocument();
  });
});
