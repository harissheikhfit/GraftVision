import { StatePanel } from "./internal-state-display";

import type { StateDensity, StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  readonly className?: string;
  readonly density?: StateDensity;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly icon?: ReactNode;
  readonly primaryAction?: ReactNode;
  readonly secondaryAction?: ReactNode;
  readonly variant?: "compact" | "full-page";
}

export function EmptyState({
  className,
  density,
  description,
  heading,
  headingLevel,
  icon,
  primaryAction,
  secondaryAction,
  variant,
}: EmptyStateProps) {
  return (
    <StatePanel
      action={primaryAction}
      className={className}
      density={density}
      description={description}
      heading={heading}
      headingLevel={headingLevel}
      icon={icon}
      marker="○"
      secondaryAction={secondaryAction}
      tone="internal"
      variant={variant}
    />
  );
}
