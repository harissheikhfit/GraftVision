import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Link } from "./link";
import { VisuallyHidden } from "./visually-hidden";

describe("Button", () => {
  it("uses a safe default type and supports pointer and keyboard activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continue</Button>);

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveAttribute("type", "button");

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("forwards explicit submit/reset types and receives visible focus", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Button type="submit">Submit example</Button>
        <Button type="reset">Reset example</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Submit example" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByRole("button", { name: "Reset example" })).toHaveAttribute("type", "reset");

    await user.tab();
    expect(screen.getByRole("button", { name: "Submit example" })).toHaveFocus();
  });

  it("prevents activation while disabled or loading", async () => {
    const user = userEvent.setup();
    const disabledAction = vi.fn();
    const loadingAction = vi.fn();

    render(
      <>
        <Button disabled onClick={disabledAction}>
          Disabled action
        </Button>
        <Button isLoading loadingLabel="Saving" onClick={loadingAction}>
          Save
        </Button>
      </>,
    );

    const disabledButton = screen.getByRole("button", {
      name: "Disabled action",
    });
    const loadingButton = screen.getByRole("button", { name: "Saving" });

    expect(disabledButton).toBeDisabled();
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");

    await user.click(disabledButton);
    await user.click(loadingButton);

    expect(disabledAction).not.toHaveBeenCalled();
    expect(loadingAction).not.toHaveBeenCalled();
  });

  it("adds a non-colour marker to destructive styling", () => {
    render(<Button variant="destructive">Remove example</Button>);

    const button = screen.getByRole("button", { name: "Remove example" });
    expect(button).toHaveClass("gv-button--destructive");
    expect(button.querySelector(".gv-button__destructive-marker")).toHaveTextContent("!");
  });
});

describe("IconButton", () => {
  it("rejects an empty accessible label", () => {
    expect(() => render(<IconButton icon={<span>+</span>} label=" " />)).toThrow(
      /non-empty accessible label/,
    );
  });

  it("requires and exposes an accessible label with a protected touch-target class", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<IconButton icon={<span>+</span>} label="Add example" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Add example" });
    expect(button).toHaveClass("gv-icon-button");
    expect(button).toHaveAttribute("type", "button");

    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prevents activation while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<IconButton disabled icon={<span>×</span>} label="Close example" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Close example" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Link and VisuallyHidden", () => {
  it("preserves anchor semantics and identifies a new external tab", () => {
    render(
      <Link external href="https://navigation.example.test">
        External example
      </Link>,
    );

    const link = screen.getByRole("link", {
      name: /External example.*opens in a new tab/i,
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("keeps visually hidden content available to the accessibility tree", () => {
    render(<VisuallyHidden>Assistive example</VisuallyHidden>);

    expect(screen.getByText("Assistive example")).toBeInTheDocument();
    expect(screen.getByText("Assistive example")).toHaveClass("gv-visually-hidden");
  });
});
