import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReadOnlyField } from "./read-only-field";
import { SearchField } from "./search-field";
import { SegmentedControl } from "./segmented-control";

const options = [
  { label: "First", value: "first" },
  { disabled: true, label: "Second", value: "second" },
  { label: "Third", value: "third" },
] as const;

describe("SearchField", () => {
  it("supports local entry, labelled clearing, Escape, and linked feedback", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <SearchField
        compact
        description="Search synthetic examples."
        error="Review the query."
        label="Example search"
        onValueChange={onValueChange}
        searchIcon={<span>?</span>}
      />,
    );

    const input = screen.getByRole("searchbox", { name: "Example search" });
    const clear = screen.getByRole("button", { name: "Clear search" });

    expect(input).toHaveAccessibleDescription("Search synthetic examples. Review the query.");
    expect(clear).toBeDisabled();
    await user.type(input, "alpha");
    expect(input).toHaveValue("alpha");
    expect(clear).toBeEnabled();
    await user.click(clear);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    await user.type(input, "beta");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("keeps a disabled search and clear action inert without network behavior", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <SearchField
        defaultValue="fixed"
        disabled
        isLoading
        label="Disabled search"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole("searchbox", { name: "Disabled search" });
    const clear = screen.getByRole("button", { name: "Clear search" });

    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(clear).toBeDisabled();
    await user.click(clear);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl", () => {
  it("uses native radio grouping, keyboard selection, and non-colour selected cues", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SegmentedControl
        defaultValue="first"
        description="Choose one option."
        error="Review this choice."
        label="Example choice"
        name="example-choice"
        onChange={onChange}
        options={options}
      />,
    );

    const group = screen.getByRole("group", { name: "Example choice" });
    const first = screen.getByRole("radio", { name: /First/u });
    const second = screen.getByRole("radio", { name: /Second/u });
    const third = screen.getByRole("radio", { name: /Third/u });

    expect(group).toHaveAccessibleDescription("Choose one option. Review this choice.");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(first).toBeChecked();
    expect(second).toBeDisabled();
    expect(first.nextElementSibling).toHaveTextContent("✓");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(third).toBeChecked();
    expect(onChange).toHaveBeenCalled();
  });

  it("rejects option counts outside the small finite-choice contract", () => {
    expect(() =>
      render(
        <SegmentedControl
          label="Too few"
          name="few"
          options={[{ label: "Only", value: "only" }]}
        />,
      ),
    ).toThrow(/between two and five options/u);
  });
});

describe("ReadOnlyField", () => {
  it("renders static, described, multiline information without an editable control", () => {
    render(
      <ReadOnlyField
        description="Static information."
        label="Read-only example"
        multiline
        value={"Line one\nLine two"}
      />,
    );

    const group = screen.getByRole("group", { name: "Read-only example" });
    expect(group).toHaveAccessibleDescription("Static information.");
    expect(group).toHaveTextContent("Line one Line two");
    expect(group.querySelector("input, textarea, select")).not.toBeInTheDocument();
    expect(group.querySelector(".gv-read-only-field__value")).toHaveClass(
      "gv-read-only-field__value",
    );
  });

  it("uses safe empty and masked displays without retaining the supplied value", () => {
    const { rerender } = render(<ReadOnlyField label="Empty example" />);
    expect(screen.getByRole("group", { name: "Empty example" })).toHaveTextContent("Not provided");

    rerender(
      <ReadOnlyField label="Masked example" masked restricted value="unmasked-sensitive-example" />,
    );

    const group = screen.getByRole("group", { name: "Masked example" });
    expect(group).toHaveTextContent("••••••");
    expect(group).not.toHaveTextContent("unmasked-sensitive-example");
    expect(group.querySelector("[data-masked='true']")).toBeInTheDocument();
    expect(screen.getByText("Restricted")).toBeInTheDocument();
  });
});
