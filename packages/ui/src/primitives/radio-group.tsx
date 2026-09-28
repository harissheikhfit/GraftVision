import {
  useId,
  type ChangeEventHandler,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { FieldDescription } from "../forms/field-description";
import { FieldError } from "../forms/field-error";
import { classNames } from "../internal/class-names";

export interface RadioGroupOption {
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly label: ReactNode;
  readonly value: string;
}

export interface RadioGroupProps extends Omit<ComponentPropsWithoutRef<"fieldset">, "onChange"> {
  readonly defaultValue?: string;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly isInvalid?: boolean;
  readonly label: ReactNode;
  readonly name: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly options: readonly RadioGroupOption[];
  readonly orientation?: "horizontal" | "vertical";
  readonly required?: boolean;
  readonly value?: string;
}

export function RadioGroup({
  className,
  defaultValue,
  description,
  disabled,
  error,
  isInvalid = false,
  label,
  name,
  onChange,
  options,
  orientation = "vertical",
  required,
  value,
  ...props
}: RadioGroupProps) {
  const generatedId = useId();
  const groupId = `gv-radio-${generatedId}`;
  const descriptionId = description ? `${groupId}-description` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const invalid = isInvalid || Boolean(error);

  return (
    <fieldset
      {...props}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={classNames("gv-radio-group", `gv-radio-group--${orientation}`, className)}
      disabled={disabled}
    >
      <legend className="gv-field-label">{label}</legend>
      {description && descriptionId ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <div className="gv-radio-group__options">
        {options.map((option, index) => {
          const optionId = `${groupId}-${index}`;
          const optionDescriptionId = option.description ? `${optionId}-description` : undefined;

          return (
            <div className="gv-radio-option" key={option.value}>
              <label className="gv-radio-option__label" htmlFor={optionId}>
                <span className="gv-choice-field__target">
                  <input
                    aria-describedby={optionDescriptionId}
                    checked={value === undefined ? undefined : value === option.value}
                    className="gv-radio"
                    defaultChecked={value === undefined && defaultValue === option.value}
                    disabled={option.disabled}
                    id={optionId}
                    name={name}
                    onChange={onChange}
                    required={required}
                    type="radio"
                    value={option.value}
                  />
                </span>
                <span>{option.label}</span>
              </label>
              {option.description && optionDescriptionId ? (
                <FieldDescription id={optionDescriptionId}>{option.description}</FieldDescription>
              ) : null}
            </div>
          );
        })}
      </div>
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
