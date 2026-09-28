import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  readonly isInvalid?: boolean;
  readonly placeholder?: string;
}

export function Select({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  children,
  className,
  disabled,
  isInvalid = false,
  placeholder,
  required,
  ...props
}: SelectProps) {
  return (
    <select
      {...props}
      aria-describedby={ariaDescribedBy}
      aria-invalid={isInvalid || ariaInvalid || undefined}
      aria-required={required || ariaRequired || undefined}
      className={classNames("gv-select", isInvalid && "gv-control--invalid", className)}
      disabled={disabled}
      required={required}
    >
      {placeholder ? (
        <option disabled value="">
          {placeholder}
        </option>
      ) : null}
      {children}
    </select>
  );
}
