import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyableValue } from "./copyable-value";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function mockClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("CopyableValue", () => {
  it("copies only after activation and announces success without repeating the value", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue();
    mockClipboard(writeText);

    render(<CopyableValue displayValue="visible-example" />);

    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Copy value" }));
    expect(writeText).toHaveBeenCalledWith("visible-example");
    expect(screen.getByText("Value copied.")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Value copied.")).not.toHaveTextContent("visible-example");
  });

  it("handles clipboard failure with generic accessible feedback", async () => {
    const user = userEvent.setup();
    mockClipboard(vi.fn<(value: string) => Promise<void>>().mockRejectedValue(new Error("denied")));

    render(<CopyableValue displayValue="visible-example" />);
    await user.click(screen.getByRole("button", { name: "Copy value" }));

    expect(await screen.findByText("Value could not be copied.")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("does not retain or copy an unmasked value unless explicitly supplied", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue();
    mockClipboard(writeText);

    const { container, rerender } = render(
      <CopyableValue displayValue="•••• 1234" masked monospace />,
    );
    expect(container).not.toHaveTextContent("hidden-unmasked-example");
    await user.click(screen.getByRole("button", { name: "Copy value" }));
    expect(writeText).toHaveBeenLastCalledWith("•••• 1234");

    rerender(
      <CopyableValue
        copyValue="explicit-unmasked-example"
        displayValue="•••• 1234"
        masked
        monospace
      />,
    );
    expect(container).not.toHaveTextContent("explicit-unmasked-example");
    await user.click(screen.getByRole("button", { name: "Copy value" }));
    expect(writeText).toHaveBeenLastCalledWith("explicit-unmasked-example");
  });
});
