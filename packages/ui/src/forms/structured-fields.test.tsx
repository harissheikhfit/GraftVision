import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TextInput } from "../primitives/text-input";

import { DateField } from "./date-field";
import { Field } from "./field";
import { FieldGroup } from "./field-group";
import { FormSection } from "./form-section";
import { InputGroup } from "./input-group";
import { InputPrefix } from "./input-prefix";
import { InputSuffix } from "./input-suffix";
import { NumberField } from "./number-field";
import { TimeField } from "./time-field";

describe("structured field composition", () => {
  it("preserves native group and section relationships", () => {
    render(
      <FormSection
        actions={<button type="button">Section action</button>}
        description="A generic section description."
        fullWidth
        heading="Example section"
        id="example-section"
        status={<span>Draft</span>}
      >
        <FieldGroup
          description="A generic group description."
          disabled
          errorSummary="Review the fields."
          heading="Example group"
        >
          <input aria-label="Nested field" />
        </FieldGroup>
      </FormSection>,
    );

    const section = screen.getByRole("region", { name: "Example section" });
    const group = screen.getByRole("group", { name: "Example group" });

    expect(section).toHaveAttribute("id", "example-section");
    expect(section).toHaveAttribute("data-full-width", "true");
    expect(section).toHaveAccessibleDescription("A generic section description.");
    expect(screen.getByRole("button", { name: "Section action" })).toBeInTheDocument();
    expect(group).toBeDisabled();
    expect(group).toHaveAccessibleDescription("A generic group description.");
    expect(screen.getByText("Review the fields.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nested field" })).toBeDisabled();
  });

  it("keeps the field label authoritative around accessible affixes", () => {
    render(
      <Field error="Check the value." label="Amount">
        {(controlProps) => (
          <InputGroup
            invalid
            prefix={<InputPrefix unit="PKR" />}
            suffix={<InputSuffix decorative={false} id="amount-unit" unit="per month" />}
          >
            <TextInput
              {...controlProps}
              aria-describedby={`${controlProps["aria-describedby"]} amount-unit`}
            />
          </InputGroup>
        )}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Amount" });
    const group = input.closest(".gv-input-group");

    expect(input).toHaveAccessibleName("Amount");
    expect(input).toHaveAccessibleDescription(/Check the value.*per month/u);
    expect(screen.getByText("PKR")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("per month")).not.toHaveAttribute("aria-hidden");
    expect(group).toHaveAttribute("data-invalid", "true");
    expect(group?.firstElementChild).toHaveClass("gv-input-affix--prefix");
    expect(group?.lastElementChild).toHaveClass("gv-input-affix--suffix");
  });
});

describe("number, date, and time foundations", () => {
  it("preserves raw number-like strings without coercion or formatting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <NumberField
        description="Enter the value exactly as supplied."
        error="The value needs review."
        label="Numeric example"
        max="999.5"
        min="-10"
        onChange={onChange}
        step="0.25"
        unit="units"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Numeric example" });
    await user.type(input, "12..3");

    expect(input).toHaveValue("12..3");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("data-min", "-10");
    expect(input).toHaveAttribute("data-max", "999.5");
    expect(input).toHaveAttribute("data-step", "0.25");
    expect(input).toHaveAccessibleDescription(
      "Enter the value exactly as supplied. The value needs review. units",
    );
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards number-field states and integer input intent", () => {
    render(
      <>
        <NumberField disabled integer label="Disabled number" value="001" />
        <NumberField label="Read-only number" readOnly value="not-a-number" />
      </>,
    );

    const disabled = screen.getByRole("textbox", { name: "Disabled number" });
    const readOnly = screen.getByRole("textbox", { name: "Read-only number" });

    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute("inputmode", "numeric");
    expect(disabled).toHaveValue("001");
    expect(readOnly).toHaveAttribute("readonly");
    expect(readOnly).toHaveValue("not-a-number");
  });

  it("uses native date and time controls with browser-facing constraints", () => {
    render(
      <>
        <DateField
          error="Review this date."
          label="Date example"
          max="2030-12-31"
          min="2020-01-01"
          required
          value="2026-07-26"
          onChange={vi.fn()}
        />
        <TimeField
          disabled
          error="Review this time."
          label="Time example"
          max="18:00"
          min="08:00"
          step={900}
          value="13:30"
          onChange={vi.fn()}
        />
      </>,
    );

    const date = screen.getByLabelText(/Date example.*required/i);
    const time = screen.getByLabelText("Time example");

    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveAttribute("min", "2020-01-01");
    expect(date).toHaveAttribute("max", "2030-12-31");
    expect(date).toHaveValue("2026-07-26");
    expect(date).toBeRequired();
    expect(date).toHaveAccessibleDescription("Review this date.");
    expect(time).toHaveAttribute("type", "time");
    expect(time).toHaveAttribute("min", "08:00");
    expect(time).toHaveAttribute("max", "18:00");
    expect(time).toHaveAttribute("step", "900");
    expect(time).toHaveValue("13:30");
    expect(time).toBeDisabled();
    expect(time).toHaveAccessibleDescription("Review this time.");
  });
});
