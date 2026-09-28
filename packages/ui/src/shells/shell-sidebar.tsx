import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellSidebarProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly collapsed?: boolean;
  readonly footer?: ReactNode;
  readonly label?: string;
  readonly secondaryNavigation?: ReactNode;
  readonly title?: ReactNode;
}

export function ShellSidebar({
  children,
  className,
  collapsed = false,
  footer,
  label = "Workspace navigation",
  secondaryNavigation,
  title,
}: ShellSidebarProps) {
  return (
    <aside
      aria-label={label}
      className={classNames(
        "gv-shell-sidebar",
        collapsed && "gv-shell-sidebar--collapsed",
        className,
      )}
      data-collapsed={collapsed || undefined}
    >
      {title ? <div className="gv-shell-sidebar__title">{title}</div> : null}
      <div className="gv-shell-sidebar__navigation">
        {children}
        {secondaryNavigation ? (
          <div className="gv-shell-sidebar__secondary">{secondaryNavigation}</div>
        ) : null}
      </div>
      {footer ? <div className="gv-shell-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
