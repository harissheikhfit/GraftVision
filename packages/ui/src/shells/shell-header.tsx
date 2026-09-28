import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellHeaderProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly context?: ReactNode;
  readonly identity: ReactNode;
  readonly indicator?: ReactNode;
  readonly mobileMenuTrigger?: ReactNode;
  readonly status?: ReactNode;
  readonly user?: ReactNode;
}

export function ShellHeader({
  action,
  className,
  context,
  identity,
  indicator,
  mobileMenuTrigger,
  status,
  user,
}: ShellHeaderProps) {
  return (
    <header className={classNames("gv-shell-header", className)}>
      {mobileMenuTrigger ? (
        <div className="gv-shell-header__menu-trigger">{mobileMenuTrigger}</div>
      ) : null}
      <div className="gv-shell-header__identity">{identity}</div>
      {context ? <div className="gv-shell-header__context">{context}</div> : null}
      <div className="gv-shell-header__status-area">
        {indicator}
        {status}
        {user}
        {action}
      </div>
    </header>
  );
}
