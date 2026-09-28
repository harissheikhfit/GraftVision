import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export type TextInputType = "email" | "password" | "search" | "tel" | "text";

export interface TextInputProps extends Omit<ComponentPropsWithRef<"input">, "size" | "type"> {
  readonly endAdornment?: ReactNode;
  readonly isInvalid?: boolean;
  readonly startAdornment?: ReactNode;
  readonly type?: TextInputType;
}

export function TextInput({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  className,
  disabled,
  endAdornment,
  isInvalid = false,
  readOnly,
  required,
  startAdornment,
  type = "text",
  ...props
}: TextInputProps) {
  return (
    <span
      className={classNames(
        "gv-control-frame",
        isInvalid && "gv-control-frame--invalid",
        disabled && "gv-control-frame--disabled",
        readOnly && "gv-control-frame--read-only",
      )}
    >
      {startAdornment ? (
        <span aria-hidden="true" className="gv-control-frame__adornment">
          {startAdornment}
        </span>
      ) : null}
      <input
        {...props}
        aria-describedby={ariaDescribedBy}
        aria-invalid={isInvalid || ariaInvalid || undefined}
        aria-required={required || ariaRequired || undefined}
        className={classNames("gv-text-input", className)}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        type={type}
      />
      {endAdornment ? (
        <span aria-hidden="true" className="gv-control-frame__adornment">
          {endAdornment}
        </span>
      ) : null}
    </span>
  );
}
