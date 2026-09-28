import { useId } from "react";

import { classNames } from "../internal/class-names";

import { Divider } from "./divider";

import type { LayoutDensity, LayoutHeadingLevel } from "./layout-types";
import type { ReactNode } from "react";

export interface SectionProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly density?: LayoutDensity;
  readonly divided?: boolean;
  readonly heading: ReactNode;
  readonly headingLevel?: LayoutHeadingLevel;
  readonly id?: string;
}

export function Section({
  actions,
  children,
  className,
  density = "comfortable",
  divided = false,
  heading,
  headingLevel = 2,
  id,
}: SectionProps) {
  const generatedId = useId();
  const sectionId = id ?? `gv-section-${generatedId}`;
  const headingId = `${sectionId}-heading`;
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      aria-labelledby={headingId}
      className={classNames("gv-section", `gv-section--density-${density}`, className)}
      id={sectionId}
    >
      {divided ? <Divider decorative /> : null}
      <header className="gv-section__header">
        <Heading id={headingId}>{heading}</Heading>
        {actions ? <div className="gv-section__actions">{actions}</div> : null}
      </header>
      <div className="gv-section__content">{children}</div>
    </section>
  );
}
