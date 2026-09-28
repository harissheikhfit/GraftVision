import { classNames } from "../internal/class-names";
import { StatusBadge, type StatusBadgeVariant } from "../states/status-badge";

import type { SessionContextState } from "./shell-types";
import type { ReactNode } from "react";

export interface SessionContextBarProps {
  readonly className?: string;
  readonly description?: ReactNode;
  readonly state: SessionContextState;
}

const sessionStatePresentation: Record<
  SessionContextState,
  { readonly label: string; readonly variant: StatusBadgeVariant }
> = {
  active: { label: "Active", variant: "in-progress" },
  expired: { label: "Expired", variant: "expired" },
  expiring: { label: "Expiring", variant: "pending" },
  offline: { label: "Offline", variant: "restricted" },
  revoked: { label: "Revoked", variant: "revoked" },
  temporary: { label: "Temporary", variant: "pending" },
  unsynced: { label: "Unsynced", variant: "review-required" },
};

export function SessionContextBar({ className, description, state }: SessionContextBarProps) {
  const presentation = sessionStatePresentation[state];

  return (
    <div
      aria-live="polite"
      className={classNames("gv-session-context", `gv-session-context--${state}`, className)}
      data-session-state={state}
      role="status"
    >
      <StatusBadge label={presentation.label} size="small" variant={presentation.variant} />
      {description ? <span className="gv-session-context__description">{description}</span> : null}
    </div>
  );
}
