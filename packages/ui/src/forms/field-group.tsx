import { useId } from "react";

import { classNames } from "../internal/class-names";

import { FieldDescription } from "./field-description";

import type { ReactNode } from "react";

export interface FieldGroupProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly density?: "comfortable" | "compact";
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly errorSummary?: ReactNode;
  readonly heading: ReactNode;
}

export function FieldGroup({
  children,
  className,
  density = "comfortable",
  description,
  disabled = false,
  errorSummary,
  heading,
}: FieldGroupProps) {
  const generatedId = useId();
  const descriptionId = description ? `gv-field-group-${generatedId}-description` : undefined;

  return (
    <fieldset
      aria-describedby={descriptionId}
      className={classNames("gv-field-group", `gv-field-group--${density}`, className)}
      disabled={disabled}
    >
      <legend className="gv-field-group__legend">{heading}</legend>
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {errorSummary ? <div className="gv-field-group__error-summary">{errorSummary}</div> : null}
      <div className="gv-field-group__fields">{children}</div>
    </fieldset>
  );
}
