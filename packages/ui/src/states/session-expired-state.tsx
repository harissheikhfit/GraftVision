import { StatePanel } from "./internal-state-display";

import type { StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface SessionExpiredStateProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading?: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
}

export function SessionExpiredState({
  action,
  className,
  description,
  heading = "Session expired",
  headingLevel,
}: SessionExpiredStateProps) {
  return (
    <StatePanel
      action={action}
      className={className}
      description={description}
      heading={heading}
      headingLevel={headingLevel}
      marker="⌛"
      tone="warning"
      variant="full-page"
    />
  );
}
