import { classNames } from "../internal/class-names";

import { LoadingIndicator } from "./loading-indicator";

import type { ReactNode } from "react";

export interface LoadingBlockProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly progressText?: ReactNode;
}

export function LoadingBlock({
  action,
  className,
  description,
  heading,
  progressText,
}: LoadingBlockProps) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={classNames("gv-loading-block", className)}
      role="status"
    >
      <LoadingIndicator decorative />
      <div>
        <h1 className="gv-loading-block__heading">{heading}</h1>
        <p className="gv-loading-block__description">{description}</p>
        {progressText ? <p className="gv-loading-block__progress">{progressText}</p> : null}
        {action ? <div className="gv-loading-block__action">{action}</div> : null}
      </div>
    </section>
  );
}
