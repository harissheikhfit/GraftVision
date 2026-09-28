import { useId } from "react";

import { classNames } from "../internal/class-names";

import type { LayoutHeadingLevel } from "../layout/layout-types";
import type { ReactNode } from "react";

export type InformationPanelVariant = "information" | "neutral" | "patient-safe" | "restricted";

export interface InformationPanelProps {
  readonly action?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly headingLevel?: LayoutHeadingLevel;
  readonly icon?: ReactNode;
  readonly status?: ReactNode;
  readonly variant?: InformationPanelVariant;
}

export function InformationPanel({
  action,
  children,
  className,
  description,
  heading,
  headingLevel = 3,
  icon,
  status,
  variant = "neutral",
}: InformationPanelProps) {
  const generatedId = useId();
  const headingId = `gv-information-panel-${generatedId}-heading`;
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      aria-labelledby={headingId}
      className={classNames("gv-information-panel", `gv-information-panel--${variant}`, className)}
    >
      {icon ? (
        <span aria-hidden="true" className="gv-information-panel__icon">
          {icon}
        </span>
      ) : null}
      <div className="gv-information-panel__content">
        <header>
          <Heading id={headingId}>{heading}</Heading>
          {status}
        </header>
        <p>{description}</p>
        {children}
        {action ? <div className="gv-information-panel__action">{action}</div> : null}
      </div>
    </section>
  );
}
