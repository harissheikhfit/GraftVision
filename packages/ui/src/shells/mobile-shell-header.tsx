import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface MobileShellHeaderProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly context?: ReactNode;
  readonly identity: ReactNode;
  readonly menuTrigger?: ReactNode;
  readonly status?: ReactNode;
}

export function MobileShellHeader({
  action,
  className,
  context,
  identity,
  menuTrigger,
  status,
}: MobileShellHeaderProps) {
  return (
    <header className={classNames("gv-mobile-shell-header", className)}>
      {menuTrigger ? <div className="gv-mobile-shell-header__menu">{menuTrigger}</div> : null}
      <div className="gv-mobile-shell-header__identity">{identity}</div>
      {context ? <div className="gv-mobile-shell-header__context">{context}</div> : null}
      {status || action ? (
        <div className="gv-mobile-shell-header__status">
          {status}
          {action}
        </div>
      ) : null}
    </header>
  );
}
