import { classNames } from "../internal/class-names";
import { ScreenLockState, type ScreenLockVariant } from "../states/screen-lock-state";

import type { ShellLockMode } from "./shell-types";
import type { ReactNode } from "react";

export interface ShellLockLayerProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading?: ReactNode;
  readonly mode: ShellLockMode;
}

const lockVariantByMode: Record<ShellLockMode, ScreenLockVariant> = {
  presentation: "expired-presentation",
  "revoked-session": "access-revoked",
  "shared-device": "shared-device-lock",
};

export function ShellLockLayer({
  action,
  className,
  description,
  heading,
  mode,
}: ShellLockLayerProps) {
  return (
    <div
      aria-label="Secure lock layer"
      className={classNames("gv-shell-lock-layer", `gv-shell-lock-layer--${mode}`, className)}
      data-lock-mode={mode}
      role="region"
    >
      <ScreenLockState
        action={action}
        description={description}
        heading={heading}
        variant={lockVariantByMode[mode]}
      />
    </div>
  );
}
