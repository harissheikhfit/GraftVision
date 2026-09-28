import { classNames } from "../internal/class-names";

import type { LayoutHeadingLevel } from "../layout/layout-types";
import type { ReactNode } from "react";

export interface DescriptionBlockProps {
  readonly action?: ReactNode;
  readonly body: ReactNode;
  readonly className?: string;
  readonly density?: "comfortable" | "compact";
  readonly heading: ReactNode;
  readonly headingLevel?: LayoutHeadingLevel;
  readonly metadata?: ReactNode;
}

export function DescriptionBlock({
  action,
  body,
  className,
  density = "comfortable",
  heading,
  headingLevel = 3,
  metadata,
}: DescriptionBlockProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <article
      className={classNames("gv-description-block", `gv-description-block--${density}`, className)}
    >
      <header>
        <Heading>{heading}</Heading>
        {metadata ? <div className="gv-description-block__metadata">{metadata}</div> : null}
      </header>
      <div className="gv-description-block__body">{body}</div>
      {action ? <div className="gv-description-block__action">{action}</div> : null}
    </article>
  );
}
