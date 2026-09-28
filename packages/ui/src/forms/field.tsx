import { useId, type ReactNode } from "react";

import { classNames } from "../internal/class-names";

import { FieldDescription } from "./field-description";
import { FieldError, type FieldErrorLiveMode } from "./field-error";
import { FieldLabel } from "./field-label";

export interface FieldControlProps {
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly "aria-required"?: true;
  readonly disabled?: true;
  readonly id: string;
  readonly readOnly?: true;
  readonly required?: true;
}

export interface FieldProps {
  readonly children: (controlProps: FieldControlProps) => ReactNode;
  readonly className?: string;
  readonly controlId?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly error?: ReactNode;
  readonly errorLive?: FieldErrorLiveMode;
  readonly label: ReactNode;
  readonly optional?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly supportingText?: ReactNode;
}

export function Field({
  children,
  className,
  controlId,
  description,
  disabled = false,
  error,
  errorLive = "off",
  label,
  optional = false,
  readOnly = false,
  required = false,
  supportingText,
}: FieldProps) {
  const generatedId = useId();
  const resolvedControlId = controlId ?? `gv-field-${generatedId}`;
  const descriptionId = description ? `${resolvedControlId}-description` : undefined;
  const errorId = error ? `${resolvedControlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const controlProps: FieldControlProps = {
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true } : {}),
    ...(required ? { "aria-required": true, required: true } : {}),
    ...(disabled ? { disabled: true } : {}),
    id: resolvedControlId,
    ...(readOnly ? { readOnly: true } : {}),
  };

  return (
    <div
      className={classNames("gv-field", className)}
      data-disabled={disabled || undefined}
      data-invalid={Boolean(error) || undefined}
      data-read-only={readOnly || undefined}
    >
      <FieldLabel
        htmlFor={resolvedControlId}
        optional={optional}
        required={required}
        supportingText={supportingText}
      >
        {label}
      </FieldLabel>
      {children(controlProps)}
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error && errorId ? (
        <FieldError id={errorId} live={errorLive}>
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}
