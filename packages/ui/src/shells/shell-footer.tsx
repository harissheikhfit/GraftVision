import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ShellFooterProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function ShellFooter({ children, className }: ShellFooterProps) {
  return <footer className={classNames("gv-shell-footer", className)}>{children}</footer>;
}
