"use client";

import { useRef, useState } from "react";

import { assignRef } from "../internal/assign-ref";
import { classNames } from "../internal/class-names";
import { IconButton } from "../primitives/icon-button";
import { LoadingIndicator } from "../states/loading-indicator";

import { Field } from "./field";
import { InputGroup } from "./input-group";
import { InputPrefix } from "./input-prefix";
import { InputSuffix } from "./input-suffix";

import type {
  ChangeEventHandler,
  ComponentPropsWithoutRef,
  KeyboardEventHandler,
  ReactNode,
  Ref,
} from "react";

export interface SearchFieldProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "children" | "defaultValue" | "onChange" | "prefix" | "type" | "value"
> {
  readonly clearLabel?: string;
  readonly compact?: boolean;
  readonly defaultValue?: string;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly fullWidth?: boolean;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly isLoading?: boolean;
  readonly label: ReactNode;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly onValueChange?: (value: string) => void;
  readonly searchIcon?: ReactNode;
  readonly submitAction?: ReactNode;
  readonly value?: string;
}

export function SearchField({
  className,
  clearLabel = "Clear search",
  compact = false,
  defaultValue = "",
  description,
  disabled = false,
  error,
  fullWidth = false,
  inputRef,
  isLoading = false,
  label,
  onChange,
  onKeyDown,
  onValueChange,
  searchIcon,
  submitAction,
  value,
  ...props
}: SearchFieldProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : uncontrolledValue;

  function updateValue(nextValue: string) {
    if (!controlled) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateValue(event.currentTarget.value);
    onChange?.(event);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "Escape" && currentValue.length > 0) {
      event.preventDefault();
      updateValue("");
    }
  };

  function clearSearch() {
    updateValue("");
    localRef.current?.focus();
  }

  return (
    <Field
      disabled={disabled}
      label={label}
      {...(description !== undefined ? { description } : {})}
      {...(error !== undefined ? { error } : {})}
    >
      {(controlProps) => (
        <InputGroup
          className={classNames(
            "gv-search-field",
            compact && "gv-search-field--compact",
            fullWidth && "gv-search-field--full-width",
            className,
          )}
          disabled={disabled}
          invalid={Boolean(error)}
          prefix={searchIcon ? <InputPrefix icon={searchIcon}>Search</InputPrefix> : undefined}
          suffix={
            <InputSuffix decorative={false} interactive>
              {isLoading ? <LoadingIndicator label="Search is loading" size="small" /> : null}
              <IconButton
                disabled={disabled || currentValue.length === 0}
                icon="×"
                label={clearLabel}
                onClick={clearSearch}
                size="small"
              />
              {submitAction}
            </InputSuffix>
          }
        >
          <input
            {...props}
            {...controlProps}
            aria-busy={isLoading || undefined}
            className="gv-input-group__native-control"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            ref={(node) => {
              localRef.current = node;
              assignRef(inputRef, node);
            }}
            type="search"
            value={currentValue}
          />
        </InputGroup>
      )}
    </Field>
  );
}
