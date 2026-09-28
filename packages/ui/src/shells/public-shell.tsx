import { AppShell } from "./app-shell";
import { ShellContent } from "./shell-content";
import { ShellFooter } from "./shell-footer";
import { ShellHeader } from "./shell-header";
import { ShellMain } from "./shell-main";
import { SkipNavigation } from "./skip-navigation";

import type { ReactNode } from "react";

export interface PublicShellProps {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly identity?: ReactNode;
}

export function PublicShell({
  action,
  children,
  footer,
  identity = "GraftVision",
}: PublicShellProps) {
  return (
    <AppShell variant="public">
      <SkipNavigation />
      <ShellHeader action={action} identity={identity} />
      <ShellMain width="standard">
        <ShellContent>{children}</ShellContent>
      </ShellMain>
      {footer ? <ShellFooter>{footer}</ShellFooter> : null}
    </AppShell>
  );
}
