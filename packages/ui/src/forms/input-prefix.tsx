import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface InputPrefixProps extends ComponentPropsWithRef<"span"> {
  readonly decorative?: boolean;
  readonly icon?: ReactNode;
  readonly interactive?: boolean;
  readonly unit?: string;
}

export function InputPrefix({
  children,
  className,
  decorative = true,
  icon,
  interactive = false,
  unit,
  ...props
}: InputPrefixProps) {
  return (
    <span
      {...props}
      aria-hidden={!interactive && decorative ? "true" : undefined}
      className={classNames(
        "gv-input-affix",
        "gv-input-affix--prefix",
        interactive && "gv-input-affix--interactive",
        className,
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {unit ?? children}
    </span>
  );
}
