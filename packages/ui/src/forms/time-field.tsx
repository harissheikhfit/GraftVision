import { classNames } from "../internal/class-names";

import { Field } from "./field";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface TimeFieldProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly label: ReactNode;
}

export function TimeField({
  className,
  description,
  disabled = false,
  error,
  label,
  readOnly = false,
  required = false,
  ...props
}: TimeFieldProps) {
  return (
    <Field
      disabled={disabled}
      label={label}
      readOnly={readOnly}
      required={required}
      {...(description !== undefined ? { description } : {})}
      {...(error !== undefined ? { error } : {})}
    >
      {(controlProps) => (
        <input
          {...props}
          {...controlProps}
          className={classNames("gv-native-field", className)}
          type="time"
        />
      )}
    </Field>
  );
}
