import { classNames } from "../internal/class-names";

import type { ResponsiveShellVisibility } from "./shell-types";
import type { ReactNode } from "react";

export interface ResponsiveShellRegionProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly visibility?: ResponsiveShellVisibility;
}

export function ResponsiveShellRegion({
  children,
  className,
  visibility = "always",
}: ResponsiveShellRegionProps) {
  return (
    <div
      className={classNames(
        "gv-responsive-shell-region",
        `gv-responsive-shell-region--${visibility}`,
        className,
      )}
      data-responsive-visibility={visibility}
    >
      {children}
    </div>
  );
}
