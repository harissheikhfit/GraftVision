import { classNames } from "../internal/class-names";

import { Field } from "./field";
import { InputGroup } from "./input-group";
import { InputSuffix } from "./input-suffix";

import type { ChangeEventHandler, ComponentPropsWithRef, ReactNode } from "react";

export interface NumberFieldProps extends Omit<
  ComponentPropsWithRef<"input">,
  "defaultValue" | "inputMode" | "max" | "min" | "step" | "type" | "value"
> {
  readonly defaultValue?: string;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly inputMode?: "decimal" | "numeric";
  readonly integer?: boolean;
  readonly label: ReactNode;
  readonly max?: string;
  readonly min?: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly step?: string;
  readonly unit?: string;
  readonly value?: string;
}

export function NumberField({
  className,
  defaultValue,
  description,
  disabled = false,
  error,
  inputMode,
  integer = false,
  label,
  max,
  min,
  readOnly = false,
  required = false,
  step,
  unit,
  value,
  ...props
}: NumberFieldProps) {
  const resolvedInputMode = inputMode ?? (integer ? "numeric" : "decimal");

  return (
    <Field
      disabled={disabled}
      label={label}
      readOnly={readOnly}
      required={required}
      {...(description !== undefined ? { description } : {})}
      {...(error !== undefined ? { error } : {})}
    >
      {(controlProps) => {
        const unitId = unit ? `${controlProps.id}-unit` : undefined;
        const describedBy =
          [controlProps["aria-describedby"], unitId].filter(Boolean).join(" ") || undefined;

        return (
          <InputGroup
            disabled={disabled}
            invalid={Boolean(error)}
            readOnly={readOnly}
            suffix={
              unit && unitId ? (
                <InputSuffix decorative={false} id={unitId} unit={unit} />
              ) : undefined
            }
          >
            <input
              {...props}
              {...controlProps}
              aria-describedby={describedBy}
              className={classNames("gv-input-group__native-control", className)}
              data-max={max}
              data-min={min}
              data-step={step}
              defaultValue={value === undefined ? defaultValue : undefined}
              inputMode={resolvedInputMode}
              type="text"
              value={value}
            />
          </InputGroup>
        );
      }}
    </Field>
  );
}
