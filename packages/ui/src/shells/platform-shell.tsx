import { ActiveUserIndicator } from "./active-user-indicator";
import { AppShell } from "./app-shell";
import { MobileBottomBar } from "./mobile-bottom-bar";
import { MobileShellHeader } from "./mobile-shell-header";
import { PrivacyContextBar } from "./privacy-context-bar";
import { ShellContent } from "./shell-content";
import { ShellFooter } from "./shell-footer";
import { ShellHeader } from "./shell-header";
import { ShellMain } from "./shell-main";
import { ShellSidebar } from "./shell-sidebar";
import { SkipNavigation } from "./skip-navigation";

import type { ReactNode } from "react";

export interface PlatformShellProps {
  readonly activeUser?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly headerAction?: ReactNode;
  readonly lockLayer?: ReactNode;
  readonly locked?: boolean;
  readonly mobileNavigation?: ReactNode;
  readonly navigation: ReactNode;
  readonly operationalContext?: ReactNode;
  readonly restrictedContext?: ReactNode;
  readonly secondaryNavigation?: ReactNode;
  readonly toolbar?: ReactNode;
}

export function PlatformShell({
  activeUser = <ActiveUserIndicator />,
  children,
  footer,
  headerAction,
  lockLayer,
  locked = false,
  mobileNavigation,
  navigation,
  operationalContext,
  restrictedContext = <PrivacyContextBar compact level="restricted" />,
  secondaryNavigation,
  toolbar,
}: PlatformShellProps) {
  const identity = "GraftVision platform operations";

  return (
    <AppShell lockLayer={lockLayer} locked={locked} variant="platform">
      <SkipNavigation />
      <ShellHeader
        action={headerAction}
        context={operationalContext}
        identity={identity}
        indicator={restrictedContext}
        user={activeUser}
      />
      <MobileShellHeader
        context={operationalContext}
        identity={identity}
        status={restrictedContext}
      />
      <div className="gv-private-shell__body">
        <ShellSidebar
          footer={footer}
          label="Platform navigation"
          secondaryNavigation={secondaryNavigation}
          title="Platform operations"
        >
          {navigation}
        </ShellSidebar>
        <ShellMain width="wide">
          {toolbar}
          <ShellContent>{children}</ShellContent>
          {footer ? <ShellFooter>{footer}</ShellFooter> : null}
        </ShellMain>
      </div>
      {mobileNavigation ? (
        <MobileBottomBar label="Mobile platform navigation">{mobileNavigation}</MobileBottomBar>
      ) : null}
    </AppShell>
  );
}
