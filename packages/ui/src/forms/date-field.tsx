import { classNames } from "../internal/class-names";

import { Field } from "./field";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface DateFieldProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly label: ReactNode;
}

export function DateField({
  className,
  description,
  disabled = false,
  error,
  label,
  readOnly = false,
  required = false,
  ...props
}: DateFieldProps) {
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
          type="date"
        />
      )}
    </Field>
  );
}
