import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export type ScreenLockVariant =
  "access-revoked" | "expired-presentation" | "session-locked" | "shared-device-lock";

export interface ScreenLockStateProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading?: ReactNode;
  readonly variant: ScreenLockVariant;
}

const lockLabels = {
  "access-revoked": "Access revoked",
  "expired-presentation": "Presentation expired",
  "session-locked": "Session locked",
  "shared-device-lock": "Shared device locked",
} as const;

export function ScreenLockState({
  action,
  className,
  description,
  heading,
  variant,
}: ScreenLockStateProps) {
  return (
    <section
      aria-label="Secure screen"
      className={classNames("gv-screen-lock", className)}
      data-lock-state={variant}
    >
      <span aria-hidden="true" className="gv-screen-lock__marker">
        ■
      </span>
      <h1>{heading ?? lockLabels[variant]}</h1>
      <p>{description}</p>
      {action ? <div className="gv-screen-lock__action">{action}</div> : null}
    </section>
  );
}
