import { StatePanel } from "./internal-state-display";

import type { StateDensity, StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface SuccessStateProps {
  readonly announce?: boolean;
  readonly className?: string;
  readonly density?: StateDensity;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly nextAction?: ReactNode;
  readonly variant?: "compact" | "full-page";
}

export function SuccessState({
  announce = false,
  className,
  density,
  description,
  heading,
  headingLevel,
  nextAction,
  variant,
}: SuccessStateProps) {
  return (
    <StatePanel
      action={nextAction}
      className={className}
      density={density}
      description={description}
      heading={heading}
      headingLevel={headingLevel}
      live={announce ? "polite" : "off"}
      marker="✓"
      tone="success"
      variant={variant}
    />
  );
}
