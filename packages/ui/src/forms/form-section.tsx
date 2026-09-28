import { useId } from "react";

import { classNames } from "../internal/class-names";
import { Divider } from "../layout/divider";

import type { ReactNode } from "react";

export interface FormSectionProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
  readonly description?: ReactNode;
  readonly divided?: boolean;
  readonly fullWidth?: boolean;
  readonly heading: ReactNode;
  readonly id?: string;
  readonly status?: ReactNode;
}

export function FormSection({
  actions,
  children,
  className,
  compact = false,
  description,
  divided = false,
  fullWidth = false,
  heading,
  id,
  status,
}: FormSectionProps) {
  const generatedId = useId();
  const sectionId = id ?? `gv-form-section-${generatedId}`;
  const headingId = `${sectionId}-heading`;
  const descriptionId = description ? `${sectionId}-description` : undefined;

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={headingId}
      className={classNames("gv-form-section", compact && "gv-form-section--compact", className)}
      data-full-width={fullWidth || undefined}
      id={sectionId}
    >
      {divided ? <Divider decorative /> : null}
      <header className="gv-form-section__header">
        <div>
          <h2 id={headingId}>{heading}</h2>
          {description && descriptionId ? <p id={descriptionId}>{description}</p> : null}
        </div>
        {status || actions ? (
          <div className="gv-form-section__aside">
            {status}
            {actions}
          </div>
        ) : null}
      </header>
      <div className="gv-form-section__content">{children}</div>
    </section>
  );
}
