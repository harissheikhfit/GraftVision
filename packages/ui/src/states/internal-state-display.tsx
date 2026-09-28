import { classNames } from "../internal/class-names";

import type { StateDensity, StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export type StateTone =
  | "ai-assisted"
  | "doctor-approved"
  | "error"
  | "information"
  | "internal"
  | "patient-safe"
  | "preliminary"
  | "restricted"
  | "success"
  | "warning";

interface BadgeBaseProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly cue: string;
  readonly description?: string | undefined;
  readonly icon?: ReactNode | undefined;
  readonly size?: "medium" | "small" | undefined;
  readonly tone: StateTone;
}

export function BadgeBase({
  children,
  className,
  cue,
  description,
  icon,
  size = "medium",
  tone,
}: BadgeBaseProps) {
  return (
    <span
      aria-description={description}
      className={classNames(
        "gv-state-badge",
        `gv-state-badge--${tone}`,
        `gv-state-badge--${size}`,
        className,
      )}
      data-tone={tone}
    >
      <span aria-hidden="true" className="gv-state-badge__cue">
        {icon ?? cue}
      </span>
      <span>{children}</span>
    </span>
  );
}

interface StatePanelProps {
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly density?: StateDensity | undefined;
  readonly description: ReactNode;
  readonly heading: ReactNode;
  readonly headingLevel?: StateHeadingLevel | undefined;
  readonly icon?: ReactNode | undefined;
  readonly live?: "assertive" | "off" | "polite" | undefined;
  readonly marker: string;
  readonly secondaryAction?: ReactNode | undefined;
  readonly tone: StateTone;
  readonly variant?: "compact" | "full-page" | undefined;
}

export function StatePanel({
  action,
  className,
  density = "comfortable",
  description,
  heading,
  headingLevel = 2,
  icon,
  live = "off",
  marker,
  secondaryAction,
  tone,
  variant = "compact",
}: StatePanelProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      aria-live={live === "off" ? undefined : live}
      className={classNames(
        "gv-state-panel",
        `gv-state-panel--${tone}`,
        `gv-state-panel--${variant}`,
        `gv-state-panel--density-${density}`,
        className,
      )}
      data-tone={tone}
    >
      <span aria-hidden="true" className="gv-state-panel__marker">
        {icon ?? marker}
      </span>
      <div className="gv-state-panel__content">
        <Heading className="gv-state-panel__heading">{heading}</Heading>
        <p className="gv-state-panel__description">{description}</p>
        {action || secondaryAction ? (
          <div className="gv-state-panel__actions">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </section>
  );
}
