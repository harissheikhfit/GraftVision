import { StatePanel } from "./internal-state-display";

import type { StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export interface PermissionDeniedStateProps {
  readonly backAction?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading?: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly requestAccessAction?: ReactNode;
  readonly requiredPermission?: string;
}

export function PermissionDeniedState({
  backAction,
  className,
  description,
  heading = "Access restricted",
  headingLevel,
  requestAccessAction,
  requiredPermission,
}: PermissionDeniedStateProps) {
  const safeDescription = (
    <>
      {description}
      {requiredPermission ? (
        <span className="gv-state-panel__reference">Required permission: {requiredPermission}</span>
      ) : null}
    </>
  );

  return (
    <StatePanel
      action={backAction}
      className={className}
      description={safeDescription}
      heading={heading}
      headingLevel={headingLevel}
      marker="!"
      secondaryAction={requestAccessAction}
      tone="restricted"
    />
  );
}
