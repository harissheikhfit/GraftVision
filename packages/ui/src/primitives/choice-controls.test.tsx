import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox";
import { RadioGroup } from "./radio-group";
import { Switch } from "./switch";

describe("Checkbox", () => {
  it("supports label, pointer, and keyboard activation with linked help", async () => {
    const user = userEvent.setup();

    render(
      <Checkbox
        description="Synthetic checkbox help."
        error="Review this checkbox."
        label="Example checkbox"
        required
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Example checkbox" });
    const description = screen.getByText("Synthetic checkbox help.");
    const error = screen.getByText("Review this checkbox.");

    expect(checkbox).toHaveAttribute(
      "aria-describedby",
      `${description.id} ${error.closest("p")?.id}`,
    );
    expect(checkbox).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByText("Example checkbox"));
    expect(checkbox).toBeChecked();

    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("sets the native indeterminate state and blocks disabled activation", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Checkbox indeterminate label="Mixed example" />
        <Checkbox disabled label="Disabled checkbox" />
      </>,
    );

    const mixed = screen.getByRole("checkbox", { name: "Mixed example" });
    await waitFor(() => {
      expect(mixed).toBePartiallyChecked();
    });

    const disabled = screen.getByRole("checkbox", { name: "Disabled checkbox" });
    await user.click(disabled);
    expect(disabled).not.toBeChecked();
  });
});

describe("RadioGroup", () => {
  it("exposes a labelled native group, selection, disabled option, and error linkage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <RadioGroup
        description="Choose one synthetic option."
        error="A reviewed selection is required."
        label="Example choices"
        name="example-choice"
        onChange={onChange}
        options={[
          { label: "First choice", value: "first" },
          { disabled: true, label: "Unavailable choice", value: "unavailable" },
          { label: "Last choice", value: "last" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Example choices" });
    const first = screen.getByRole("radio", { name: "First choice" });
    const unavailable = screen.getByRole("radio", { name: "Unavailable choice" });
    const last = screen.getByRole("radio", { name: "Last choice" });

    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-describedby");
    expect(unavailable).toBeDisabled();

    await user.click(first);
    expect(first).toBeChecked();
    expect(onChange).toHaveBeenCalledOnce();

    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(last).toBeChecked();
  });
});

describe("Switch", () => {
  it("uses switch semantics with a label, description, pointer, and keyboard activation", async () => {
    const user = userEvent.setup();

    render(
      <Switch
        description="Synthetic switch help."
        label="Example setting"
        offLabel="Disabled"
        onLabel="Enabled"
      />,
    );

    const control = screen.getByRole("switch", { name: "Example setting" });
    const description = screen.getByText("Synthetic switch help.");

    expect(control).toHaveAttribute("aria-describedby", description.id);
    expect(control).not.toBeChecked();

    await user.click(screen.getByText("Example setting"));
    expect(control).toBeChecked();

    control.focus();
    await user.keyboard(" ");
    expect(control).not.toBeChecked();
  });

  it("blocks disabled activation and links errors", async () => {
    const user = userEvent.setup();

    render(<Switch disabled error="Setting unavailable." label="Disabled setting" />);

    const control = screen.getByRole("switch", { name: "Disabled setting" });
    const error = screen.getByText("Setting unavailable.");

    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-describedby", error.closest("p")?.id);
    await user.click(control);
    expect(control).not.toBeChecked();
  });
});
