import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellNavigationProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
  readonly label: string;
  readonly mobile?: boolean;
}

export function ShellNavigation({
  children,
  className,
  compact = false,
  label,
  mobile = false,
}: ShellNavigationProps) {
  return (
    <nav
      aria-label={label}
      className={classNames(
        "gv-shell-navigation",
        compact && "gv-shell-navigation--compact",
        mobile && "gv-shell-navigation--mobile",
        className,
      )}
    >
      <ul>{children}</ul>
    </nav>
  );
}
