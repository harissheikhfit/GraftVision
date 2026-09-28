import { AppShell } from "./app-shell";
import { MobileShellHeader } from "./mobile-shell-header";
import { ShellContent } from "./shell-content";
import { ShellMain } from "./shell-main";
import { SkipNavigation } from "./skip-navigation";

import type { ReactNode } from "react";

export interface ScanShellProps {
  readonly bottomAction?: ReactNode;
  readonly children: ReactNode;
  readonly confirmation?: ReactNode;
  readonly connectivity?: ReactNode;
  readonly lockLayer?: ReactNode;
  readonly locked?: boolean;
  readonly progress?: ReactNode;
  readonly sessionContext?: ReactNode;
  readonly sessionMode?: boolean;
  readonly stepTitle?: ReactNode;
}

export function ScanShell({
  bottomAction,
  children,
  confirmation,
  connectivity,
  lockLayer,
  locked = false,
  progress,
  sessionContext,
  sessionMode = false,
  stepTitle,
}: ScanShellProps) {
  return (
    <AppShell lockLayer={lockLayer} locked={locked} variant="scan">
      <SkipNavigation />
      <MobileShellHeader
        context={sessionContext}
        identity={sessionMode ? "Temporary scan workspace" : "GraftVision Scan"}
        status={connectivity}
      />
      {confirmation ? <div className="gv-scan-shell__confirmation">{confirmation}</div> : null}
      <ShellMain width="full">
        <ShellContent density="compact">
          {stepTitle ? <div className="gv-scan-shell__step-title">{stepTitle}</div> : null}
          {progress ? <div className="gv-scan-shell__progress">{progress}</div> : null}
          <div className="gv-scan-shell__work-region">{children}</div>
        </ShellContent>
      </ShellMain>
      {bottomAction ? (
        <footer className="gv-scan-shell__bottom-action">{bottomAction}</footer>
      ) : null}
    </AppShell>
  );
}
