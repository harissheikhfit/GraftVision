import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface StatProps {
  readonly className?: string;
  readonly emptyValue?: string;
  readonly label: ReactNode;
  readonly size?: "compact" | "large";
  readonly supportingText?: ReactNode;
  readonly trend?: ReactNode;
  readonly value?: ReactNode;
}

export function Stat({
  className,
  emptyValue = "Not provided",
  label,
  size = "compact",
  supportingText,
  trend,
  value,
}: StatProps) {
  return (
    <div className={classNames("gv-stat", `gv-stat--${size}`, className)}>
      <div className="gv-stat__label">{label}</div>
      <div className="gv-stat__value">
        {value === undefined || value === null ? emptyValue : value}
      </div>
      {supportingText ? <div className="gv-stat__supporting">{supportingText}</div> : null}
      {trend ? <div className="gv-stat__trend">{trend}</div> : null}
    </div>
  );
}
