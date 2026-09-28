import { StatePanel } from "./internal-state-display";

import type { StateDensity, StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface WarningStateProps {
  readonly action?: ReactNode;
  readonly announce?: boolean;
  readonly className?: string;
  readonly density?: StateDensity;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly variant?: "compact" | "full-page";
}

export function WarningState({
  action,
  announce = false,
  className,
  density,
  description,
  heading,
  headingLevel,
  variant,
}: WarningStateProps) {
  return (
    <StatePanel
      action={action}
      className={className}
      density={density}
      description={description}
      heading={heading}
      headingLevel={headingLevel}
      live={announce ? "polite" : "off"}
      marker="!"
      tone="warning"
      variant={variant}
    />
  );
}
