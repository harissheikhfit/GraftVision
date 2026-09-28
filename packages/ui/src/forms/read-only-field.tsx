import { useId } from "react";

import { classNames } from "../internal/class-names";
import { RestrictedBadge } from "../states/restricted-badge";

import type { ReactNode } from "react";

export interface ReadOnlyFieldProps {
  readonly className?: string;
  readonly copyAction?: ReactNode;
  readonly description?: ReactNode;
  readonly emptyValue?: string;
  readonly label: ReactNode;
  readonly masked?: boolean;
  readonly maskedValue?: string;
  readonly multiline?: boolean;
  readonly restricted?: boolean;
  readonly value?: ReactNode;
}

export function ReadOnlyField({
  className,
  copyAction,
  description,
  emptyValue = "Not provided",
  label,
  masked = false,
  maskedValue = "••••••",
  multiline = false,
  restricted = false,
  value,
}: ReadOnlyFieldProps) {
  const generatedId = useId();
  const labelId = `gv-read-only-${generatedId}-label`;
  const descriptionId = description ? `${labelId}-description` : undefined;
  const displayValue = masked ? maskedValue : (value ?? emptyValue);

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={labelId}
      className={classNames(
        "gv-read-only-field",
        multiline && "gv-read-only-field--multiline",
        restricted && "gv-read-only-field--restricted",
        className,
      )}
      role="group"
    >
      <div className="gv-read-only-field__header">
        <span className="gv-read-only-field__label" id={labelId}>
          {label}
        </span>
        {restricted ? <RestrictedBadge /> : null}
      </div>
      <div className="gv-read-only-field__value" data-masked={masked || undefined}>
        {displayValue}
      </div>
      {description && descriptionId ? (
        <p className="gv-read-only-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {copyAction ? <div className="gv-read-only-field__action">{copyAction}</div> : null}
    </div>
  );
}
