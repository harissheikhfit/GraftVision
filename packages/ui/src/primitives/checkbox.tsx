"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";

import { FieldDescription } from "../forms/field-description";
import { FieldError } from "../forms/field-error";
import { classNames } from "../internal/class-names";

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<"input">,
  "aria-checked" | "children" | "type"
> {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly indeterminate?: boolean;
  readonly isInvalid?: boolean;
  readonly label: ReactNode;
}

export function Checkbox({
  checked,
  className,
  defaultChecked,
  description,
  disabled,
  error,
  id,
  indeterminate = false,
  isInvalid = false,
  label,
  ref,
  required,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const resolvedId = id ?? `gv-checkbox-${generatedId}`;
  const descriptionId = description ? `${resolvedId}-description` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const invalid = isInvalid || Boolean(error);

  useImperativeHandle(ref, () => {
    if (!inputRef.current) {
      throw new Error("Checkbox ref is unavailable before the input mounts.");
    }

    return inputRef.current;
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div
      className={classNames("gv-choice-field", className)}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      <label className="gv-choice-field__label" htmlFor={resolvedId}>
        <span className="gv-choice-field__target">
          <input
            {...props}
            aria-checked={indeterminate ? "mixed" : undefined}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            checked={checked}
            className="gv-checkbox"
            defaultChecked={defaultChecked}
            disabled={disabled}
            id={resolvedId}
            ref={inputRef}
            required={required}
            type="checkbox"
          />
        </span>
        <span>{label}</span>
      </label>
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
