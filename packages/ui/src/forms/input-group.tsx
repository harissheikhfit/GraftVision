import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface InputGroupProps extends Omit<ComponentPropsWithRef<"div">, "prefix"> {
  readonly disabled?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly prefix?: ReactNode | undefined;
  readonly readOnly?: boolean | undefined;
  readonly suffix?: ReactNode | undefined;
}

export function InputGroup({
  children,
  className,
  disabled = false,
  invalid = false,
  prefix,
  readOnly = false,
  suffix,
  ...props
}: InputGroupProps) {
  return (
    <div
      {...props}
      className={classNames(
        "gv-input-group",
        disabled && "gv-input-group--disabled",
        invalid && "gv-input-group--invalid",
        readOnly && "gv-input-group--read-only",
        className,
      )}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-read-only={readOnly || undefined}
    >
      {prefix}
      <div className="gv-input-group__control">{children}</div>
      {suffix}
    </div>
  );
}
