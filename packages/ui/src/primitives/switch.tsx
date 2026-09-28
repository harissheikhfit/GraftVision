import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { FieldDescription } from "../forms/field-description";
import { FieldError } from "../forms/field-error";
import { classNames } from "../internal/class-names";

export interface SwitchProps extends Omit<
  ComponentPropsWithRef<"input">,
  "aria-checked" | "children" | "type"
> {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly isInvalid?: boolean;
  readonly label: ReactNode;
  readonly offLabel?: string;
  readonly onLabel?: string;
}

export function Switch({
  className,
  description,
  disabled,
  error,
  id,
  isInvalid = false,
  label,
  offLabel = "Off",
  onLabel = "On",
  required,
  ...props
}: SwitchProps) {
  const generatedId = useId();
  const resolvedId = id ?? `gv-switch-${generatedId}`;
  const descriptionId = description ? `${resolvedId}-description` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const invalid = isInvalid || Boolean(error);

  return (
    <div
      className={classNames("gv-switch-field", className)}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      <label className="gv-switch-field__label" htmlFor={resolvedId}>
        <input
          {...props}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className="gv-switch"
          disabled={disabled}
          id={resolvedId}
          required={required}
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true" className="gv-switch__track">
          <span className="gv-switch__thumb" />
        </span>
        <span className="gv-switch__content">
          <span>{label}</span>
          <span aria-hidden="true" className="gv-switch__state">
            <span className="gv-switch__state-on">{onLabel}</span>
            <span className="gv-switch__state-off">{offLabel}</span>
          </span>
        </span>
      </label>
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
