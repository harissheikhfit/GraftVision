import { useId } from "react";

import { classNames } from "../internal/class-names";

import { FieldDescription } from "./field-description";
import { FieldError } from "./field-error";

import type { ChangeEventHandler, ComponentPropsWithoutRef, ReactNode } from "react";

export interface SegmentedControlOption {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

export interface SegmentedControlProps extends Omit<
  ComponentPropsWithoutRef<"fieldset">,
  "onChange"
> {
  readonly defaultValue?: string;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly fullWidth?: boolean;
  readonly label: ReactNode;
  readonly name: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly options: readonly SegmentedControlOption[];
  readonly required?: boolean;
  readonly value?: string;
}

export function SegmentedControl({
  className,
  defaultValue,
  description,
  disabled,
  error,
  fullWidth = false,
  label,
  name,
  onChange,
  options,
  required,
  value,
  ...props
}: SegmentedControlProps) {
  if (options.length < 2 || options.length > 5) {
    throw new Error("SegmentedControl requires between two and five options.");
  }

  const generatedId = useId();
  const groupId = `gv-segmented-${generatedId}`;
  const descriptionId = description ? `${groupId}-description` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      {...props}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error) || undefined}
      className={classNames("gv-segmented", fullWidth && "gv-segmented--full-width", className)}
      disabled={disabled}
    >
      <legend className="gv-field-label">{label}</legend>
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <div className="gv-segmented__options">
        {options.map((option, index) => {
          const optionId = `${groupId}-${index}`;

          return (
            <label className="gv-segmented__option" htmlFor={optionId} key={option.value}>
              <input
                checked={value === undefined ? undefined : value === option.value}
                defaultChecked={value === undefined && defaultValue === option.value}
                disabled={option.disabled}
                id={optionId}
                name={name}
                onChange={onChange}
                required={required}
                type="radio"
                value={option.value}
              />
              <span aria-hidden="true" className="gv-segmented__selection-cue">
                ✓
              </span>
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
