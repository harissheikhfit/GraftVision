import { classNames } from "../internal/class-names";

import type { ShellVariant } from "./shell-types";
import type { ReactNode } from "react";

export interface AppShellProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly lockLayer?: ReactNode;
  readonly locked?: boolean;
  readonly variant: ShellVariant;
}

export function AppShell({
  children,
  className,
  lockLayer,
  locked = false,
  variant,
}: AppShellProps) {
  return (
    <div
      className={classNames("gv-app-shell", `gv-app-shell--${variant}`, className)}
      data-shell-variant={variant}
      data-shell-locked={locked || undefined}
    >
      <div aria-hidden={locked || undefined} className="gv-app-shell__frame" inert={locked}>
        {children}
      </div>
      {locked ? lockLayer : null}
    </div>
  );
}
