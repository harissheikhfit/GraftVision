import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ActiveContextBannerProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
  readonly description?: ReactNode;
  readonly label?: string;
  readonly value?: ReactNode;
}

export function ActiveContextBanner({
  action,
  className,
  compact = false,
  description,
  label = "Active context",
  value = "No active context",
}: ActiveContextBannerProps) {
  return (
    <section
      aria-label={label}
      className={classNames(
        "gv-active-context",
        compact && "gv-active-context--compact",
        className,
      )}
    >
      <span aria-hidden="true" className="gv-active-context__cue">
        ◇
      </span>
      <span className="gv-active-context__content">
        <span>{label}</span>
        <strong>{value}</strong>
        {description ? <span>{description}</span> : null}
      </span>
      {action ? <span className="gv-active-context__action">{action}</span> : null}
    </section>
  );
}
