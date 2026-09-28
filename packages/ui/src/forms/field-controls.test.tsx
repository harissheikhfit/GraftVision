import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select } from "../primitives/select";
import { TextInput } from "../primitives/text-input";
import { Textarea } from "../primitives/textarea";

import { Field, type FieldControlProps } from "./field";

function RequiredInvalidInput(controlProps: FieldControlProps) {
  return <TextInput {...controlProps} onChange={vi.fn()} placeholder="Synthetic value" />;
}

function DisabledInput(controlProps: FieldControlProps) {
  return <TextInput {...controlProps} />;
}

function ReadOnlyTextarea(controlProps: FieldControlProps) {
  return <Textarea {...controlProps} defaultValue="Synthetic notes" maxLength={120} />;
}

function ExampleSelect(controlProps: FieldControlProps) {
  return (
    <Select {...controlProps} placeholder="Choose an option">
      <option value="first">First option</option>
      <option value="second">Second option</option>
    </Select>
  );
}

describe("Field and text controls", () => {
  it("associates label, description, error, required, and invalid semantics", () => {
    render(
      <Field
        description="Use a synthetic value."
        error="A value is required."
        errorLive="polite"
        label="Example field"
        required
      >
        {RequiredInvalidInput}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: /Example field.*required/i });
    const description = screen.getByText("Use a synthetic value.");
    const error = screen.getByText("A value is required.");

    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      `${description.id} ${error.closest("p")?.id}`,
    );
    expect(error.closest("p")).toHaveAttribute("aria-live", "polite");
  });

  it("forwards change behaviour and standard input attributes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Field controlId="email-example" label="Email example">
        {(controlProps) => (
          <TextInput
            {...controlProps}
            autoComplete="email"
            inputMode="email"
            onChange={onChange}
            type="email"
          />
        )}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email example" });
    await user.type(input, "synthetic@ui.example.test");

    expect(input).toHaveValue("synthetic@ui.example.test");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).toHaveAttribute("inputmode", "email");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards disabled and read-only states without hiding their semantics", () => {
    render(
      <>
        <Field disabled label="Disabled example">
          {DisabledInput}
        </Field>
        <Field label="Read-only example" readOnly>
          {ReadOnlyTextarea}
        </Field>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Disabled example" })).toBeDisabled();
    const textarea = screen.getByRole("textbox", { name: "Read-only example" });
    expect(textarea).toHaveAttribute("readonly");
    expect(textarea).toHaveAttribute("maxlength", "120");
  });

  it("uses native select semantics with placeholder and linked field text", async () => {
    const user = userEvent.setup();

    render(
      <Field
        description="Choose one synthetic option."
        error="Review this selection."
        label="Selection example"
        required
      >
        {ExampleSelect}
      </Field>,
    );

    const select = screen.getByRole("combobox", { name: /Selection example.*required/i });
    const description = screen.getByText("Choose one synthetic option.");
    const error = screen.getByText("Review this selection.");

    expect(select).toHaveAttribute(
      "aria-describedby",
      `${description.id} ${error.closest("p")?.id}`,
    );
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("option", { name: "Choose an option" })).toBeDisabled();

    await user.selectOptions(select, "second");
    expect(select).toHaveValue("second");
  });
});
