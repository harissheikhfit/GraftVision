import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellToolbarProps {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly label?: string;
  readonly status?: ReactNode;
  readonly title?: ReactNode;
}

export function ShellToolbar({
  actions,
  className,
  label = "Page tools",
  status,
  title,
}: ShellToolbarProps) {
  return (
    <section aria-label={label} className={classNames("gv-shell-toolbar", className)}>
      {title ? <div className="gv-shell-toolbar__title">{title}</div> : null}
      {status ? <div className="gv-shell-toolbar__status">{status}</div> : null}
      {actions ? <div className="gv-shell-toolbar__actions">{actions}</div> : null}
    </section>
  );
}
