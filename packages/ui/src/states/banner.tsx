import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export type BannerVariant =
  | "error"
  | "information"
  | "offline"
  | "restricted"
  | "success"
  | "support-access-active"
  | "temporary-session"
  | "unsynced"
  | "warning";

export interface BannerProps {
  readonly action?: ReactNode;
  readonly announce?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: ReactNode;
  readonly variant?: BannerVariant;
}

const bannerPresentation = {
  error: { marker: "!", tone: "error" },
  information: { marker: "i", tone: "information" },
  offline: { marker: "○", tone: "warning" },
  restricted: { marker: "!", tone: "restricted" },
  success: { marker: "✓", tone: "success" },
  "support-access-active": { marker: "S", tone: "restricted" },
  "temporary-session": { marker: "T", tone: "warning" },
  unsynced: { marker: "↻", tone: "warning" },
  warning: { marker: "!", tone: "warning" },
} as const;

export function Banner({
  action,
  announce = false,
  children,
  className,
  title,
  variant = "information",
}: BannerProps) {
  const presentation = bannerPresentation[variant];
  const role = announce ? (variant === "error" ? "alert" : "status") : "region";
  const accessibleLabel = typeof title === "string" && title.trim() ? title : "Application notice";

  return (
    <aside
      aria-label={accessibleLabel}
      className={classNames("gv-banner", `gv-banner--${presentation.tone}`, className)}
      role={role}
    >
      <span aria-hidden="true" className="gv-banner__marker">
        {presentation.marker}
      </span>
      <div className="gv-banner__content">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {action ? <div className="gv-banner__action">{action}</div> : null}
    </aside>
  );
}
