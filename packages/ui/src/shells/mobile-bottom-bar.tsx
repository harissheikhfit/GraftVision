import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface MobileBottomBarProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label?: string;
}

export function MobileBottomBar({
  children,
  className,
  label = "Mobile navigation",
}: MobileBottomBarProps) {
  return (
    <nav aria-label={label} className={classNames("gv-mobile-bottom-bar", className)}>
      {children}
    </nav>
  );
}
