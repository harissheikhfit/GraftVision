import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export type InlineMessageVariant = "error" | "information" | "restricted" | "success" | "warning";

export interface InlineMessageProps {
  readonly action?: ReactNode;
  readonly announce?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly icon?: ReactNode;
  readonly title?: ReactNode;
  readonly variant?: InlineMessageVariant;
}

const inlinePresentation = {
  error: { marker: "!", tone: "error" },
  information: { marker: "i", tone: "information" },
  restricted: { marker: "!", tone: "restricted" },
  success: { marker: "✓", tone: "success" },
  warning: { marker: "!", tone: "warning" },
} as const;

export function InlineMessage({
  action,
  announce = false,
  children,
  className,
  icon,
  title,
  variant = "information",
}: InlineMessageProps) {
  const presentation = inlinePresentation[variant];
  const role = announce ? (variant === "error" ? "alert" : "status") : "note";

  return (
    <div
      className={classNames(
        "gv-inline-message",
        `gv-inline-message--${presentation.tone}`,
        className,
      )}
      role={role}
    >
      <span aria-hidden="true" className="gv-inline-message__marker">
        {icon ?? presentation.marker}
      </span>
      <div className="gv-inline-message__content">
        {title ? <strong className="gv-inline-message__title">{title}</strong> : null}
        <div>{children}</div>
      </div>
      {action ? <div className="gv-inline-message__action">{action}</div> : null}
    </div>
  );
}
