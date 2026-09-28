import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PlatformError from "./error";
import PlatformLoading from "./loading";

describe("platform route states", () => {
  it("announces safe loading states", () => {
    render(<PlatformLoading />);

    expect(screen.getByRole("heading", { name: "Loading platform summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loading clinics" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("renders a privacy-safe recoverable error", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<PlatformError error={new Error("sensitive internal detail")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Platform administration is unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("sensitive internal detail")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
