import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShellNotice } from "./index";

describe("ShellNotice", () => {
  it("renders a labelled, focusable main landmark with one page heading", () => {
    render(
      <ShellNotice
        label="Synthetic development shell"
        message="No functionality implemented."
        title="GraftVision test shell"
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "GraftVision test shell",
    });
    const main = screen.getByRole("main");

    expect(heading).toBeInTheDocument();
    expect(main).toContainElement(heading);
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Synthetic development shell")).toBeInTheDocument();
    expect(screen.getByText("No functionality implemented.")).toBeInTheDocument();
  });
});
