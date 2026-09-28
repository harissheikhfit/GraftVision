import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface InputSuffixProps extends ComponentPropsWithRef<"span"> {
  readonly decorative?: boolean;
  readonly icon?: ReactNode;
  readonly interactive?: boolean;
  readonly unit?: string;
}

export function InputSuffix({
  children,
  className,
  decorative = true,
  icon,
  interactive = false,
  unit,
  ...props
}: InputSuffixProps) {
  return (
    <span
      {...props}
      aria-hidden={!interactive && decorative ? "true" : undefined}
      className={classNames(
        "gv-input-affix",
        "gv-input-affix--suffix",
        interactive && "gv-input-affix--interactive",
        className,
      )}
    >
      {unit ?? children}
      {icon ? <span aria-hidden="true">{icon}</span> : null}
    </span>
  );
}
