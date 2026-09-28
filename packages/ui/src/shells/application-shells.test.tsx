import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClinicShell } from "./clinic-shell";
import { PlatformShell } from "./platform-shell";
import { PrivacyContextBar } from "./privacy-context-bar";
import { PublicShell } from "./public-shell";
import { SessionContextBar } from "./session-context-bar";
import { ShellNavigation } from "./shell-navigation";
import { ShellNavigationItem } from "./shell-navigation-item";
import { ShellToolbar } from "./shell-toolbar";

const navigation = (
  <ShellNavigation label="Test navigation">
    <ShellNavigationItem active badge="New" href="/current" label="Current shell" />
    <ShellNavigationItem href="/reserved" label="Reserved area" unavailable />
  </ShellNavigation>
);

describe("application shells", () => {
  it("provides a public landmark and skip target without private context", () => {
    render(
      <PublicShell footer="Foundation only">
        <h1>Public shell</h1>
      </PublicShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByText("GraftVision")).toBeInTheDocument();
    expect(screen.queryByLabelText("Privacy context")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Active user")).not.toBeInTheDocument();
  });

  it("composes clinic context, status, navigation, and toolbar slots", () => {
    render(
      <ClinicShell
        navigation={navigation}
        sessionContext={<SessionContextBar state="temporary" />}
        toolbar={<ShellToolbar title={<h1>Clinic shell</h1>} />}
      >
        Neutral content
      </ClinicShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Test navigation" });
    expect(within(nav).getByRole("link", { name: "Current shellNew" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).queryByRole("link", { name: "Reserved area" })).not.toBeInTheDocument();
    expect(within(nav).getByText("Reserved area").closest("[aria-disabled]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getAllByText("No active context")).not.toHaveLength(0);
    expect(screen.getAllByLabelText("Active user")).not.toHaveLength(0);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Temporary");
    expect(screen.getByRole("main").closest(".gv-private-shell__body")).toBeInTheDocument();
  });

  it("keeps the platform shell operational and restricted by default", () => {
    render(
      <PlatformShell navigation={navigation}>
        <h1>Platform shell</h1>
      </PlatformShell>,
    );

    expect(screen.getAllByText("GraftVision platform operations")).not.toHaveLength(0);
    expect(screen.getAllByText("Restricted context")).not.toHaveLength(0);
    expect(screen.queryByText("No active context")).not.toBeInTheDocument();
  });

  it("renders privacy levels as text-backed protected state", () => {
    render(
      <PrivacyContextBar
        description="Only explicitly safe material belongs here."
        level="patient-safe"
      />,
    );

    expect(screen.getByLabelText("Privacy context")).toHaveAttribute(
      "data-privacy-level",
      "patient-safe",
    );
    expect(screen.getByText("Patient-safe context")).toBeInTheDocument();
  });
});
