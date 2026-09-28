import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellOverlayRegionProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly visible?: boolean;
}

export function ShellOverlayRegion({
  children,
  className,
  label,
  visible = false,
}: ShellOverlayRegionProps) {
  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label={label}
      className={classNames("gv-shell-overlay-region", className)}
      data-overlay-visible="true"
    >
      {children}
    </aside>
  );
}
