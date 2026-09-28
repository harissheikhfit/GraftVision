import { ActiveContextBanner } from "./active-context-banner";
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

export interface ClinicShellProps {
  readonly activeContext?: ReactNode;
  readonly activeUser?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly headerAction?: ReactNode;
  readonly identity?: ReactNode;
  readonly lockLayer?: ReactNode;
  readonly locked?: boolean;
  readonly mobileAction?: ReactNode;
  readonly mobileNavigation?: ReactNode;
  readonly navigation: ReactNode;
  readonly privacyContext?: ReactNode;
  readonly secondaryNavigation?: ReactNode;
  readonly sessionContext?: ReactNode;
  readonly toolbar?: ReactNode;
}

export function ClinicShell({
  activeContext = <ActiveContextBanner />,
  activeUser = <ActiveUserIndicator />,
  children,
  footer,
  headerAction,
  identity = "Clinic workspace",
  lockLayer,
  locked = false,
  mobileAction,
  mobileNavigation,
  navigation,
  privacyContext = <PrivacyContextBar compact level="internal-workspace" />,
  secondaryNavigation,
  sessionContext,
  toolbar,
}: ClinicShellProps) {
  return (
    <AppShell lockLayer={lockLayer} locked={locked} variant="clinic">
      <SkipNavigation />
      <ShellHeader
        action={headerAction}
        context={activeContext}
        identity={identity}
        indicator={privacyContext}
        status={sessionContext}
        user={activeUser}
      />
      <MobileShellHeader
        action={mobileAction}
        context={activeContext}
        identity={identity}
        status={privacyContext}
      />
      <div className="gv-private-shell__body">
        <ShellSidebar footer={footer} secondaryNavigation={secondaryNavigation} title="Workspace">
          {navigation}
        </ShellSidebar>
        <ShellMain width="full">
          {toolbar}
          <ShellContent>{children}</ShellContent>
          {footer ? <ShellFooter>{footer}</ShellFooter> : null}
        </ShellMain>
      </div>
      {mobileNavigation ? (
        <MobileBottomBar label="Mobile workspace navigation">{mobileNavigation}</MobileBottomBar>
      ) : null}
    </AppShell>
  );
}
