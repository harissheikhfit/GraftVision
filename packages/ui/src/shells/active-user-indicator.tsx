import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ActiveUserIndicatorProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly label?: string;
  readonly value?: ReactNode;
}

export function ActiveUserIndicator({
  action,
  className,
  label = "Active user",
  value = "No user details shown",
}: ActiveUserIndicatorProps) {
  return (
    <aside aria-label={label} className={classNames("gv-active-user", className)}>
      <span aria-hidden="true" className="gv-active-user__cue">
        U
      </span>
      <span className="gv-active-user__content">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      {action ? <span className="gv-active-user__action">{action}</span> : null}
    </aside>
  );
}
