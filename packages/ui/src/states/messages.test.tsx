import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../primitives/button";

import { Banner } from "./banner";
import { InlineMessage } from "./inline-message";

describe("messages and banners", () => {
  it("does not use alert semantics for ordinary information", () => {
    render(<InlineMessage title="Information">Review the available details.</InlineMessage>);

    expect(screen.getByRole("note")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses alert semantics only for an explicitly announced error", () => {
    render(
      <InlineMessage announce title="Unable to continue" variant="error">
        Review the information and try again.
      </InlineMessage>,
    );

    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("renders a protected full-width banner and keyboard-safe action slot", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();

    render(
      <Banner action={<Button onClick={onReview}>Review</Button>} title="Offline" variant="offline">
        Changes may not be current.
      </Banner>,
    );

    expect(screen.getByRole("region")).toHaveClass("gv-banner--warning");
    const action = screen.getByRole("button", { name: "Review" });
    action.focus();
    expect(action).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("does not expose dismiss behaviour when persistence is unavailable", () => {
    render(<Banner variant="temporary-session">This session is temporary.</Banner>);

    expect(screen.queryByRole("button", { name: /dismiss|close/i })).not.toBeInTheDocument();
  });
});
