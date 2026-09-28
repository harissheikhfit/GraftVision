import { AppShell } from "./app-shell";
import { PresentationFooter } from "./presentation-footer";
import { PresentationHeader } from "./presentation-header";
import { ShellMain } from "./shell-main";
import { SkipNavigation } from "./skip-navigation";

import type { ReactNode } from "react";

export interface PresentationShellProps {
  readonly children: ReactNode;
  readonly footerControls?: ReactNode;
  readonly footerMarker?: ReactNode;
  readonly footerSupporting?: ReactNode;
  readonly headerIndicator?: ReactNode;
  readonly identity?: ReactNode;
  readonly lockLayer?: ReactNode;
  readonly locked?: boolean;
  readonly sessionMode?: boolean;
  readonly title?: ReactNode;
}

export function PresentationShell({
  children,
  footerControls,
  footerMarker,
  footerSupporting,
  headerIndicator,
  identity,
  lockLayer,
  locked = false,
  sessionMode = false,
  title,
}: PresentationShellProps) {
  return (
    <AppShell lockLayer={lockLayer} locked={locked} variant="presentation">
      <SkipNavigation />
      <PresentationHeader
        identity={identity}
        indicator={headerIndicator}
        title={title ?? (sessionMode ? "Temporary presentation" : undefined)}
      />
      <ShellMain width="presentation">{children}</ShellMain>
      <PresentationFooter
        controls={footerControls}
        marker={footerMarker}
        supporting={footerSupporting}
      />
    </AppShell>
  );
}
