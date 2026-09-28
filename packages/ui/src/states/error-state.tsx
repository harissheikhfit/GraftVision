import { StatePanel } from "./internal-state-display";

import type { StateDensity, StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  readonly announce?: boolean;
  readonly className?: string;
  readonly density?: StateDensity;
  readonly description: ReactNode;
  readonly errorReference?: string;
  readonly heading: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly retryAction?: ReactNode;
  readonly supportAction?: ReactNode;
  readonly variant?: "compact" | "full-page";
}

export function ErrorState({
  announce = false,
  className,
  density,
  description,
  errorReference,
  heading,
  headingLevel,
  retryAction,
  supportAction,
  variant,
}: ErrorStateProps) {
  const safeDescription = (
    <>
      {description}
      {errorReference ? (
        <span className="gv-state-panel__reference">Reference: {errorReference}</span>
      ) : null}
    </>
  );

  return (
    <StatePanel
      action={retryAction}
      className={className}
      density={density}
      description={safeDescription}
      heading={heading}
      headingLevel={headingLevel}
      live={announce ? "assertive" : "off"}
      marker="!"
      secondaryAction={supportAction}
      tone="error"
      variant={variant}
    />
  );
}
