import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export type ButtonVariant = "destructive" | "primary" | "quiet" | "secondary";
export type ButtonSize = "large" | "medium" | "small";

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "disabled" | "type"> {
  readonly disabled?: boolean;
  readonly fullWidth?: boolean;
  readonly isLoading?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly loadingLabel?: string;
  readonly size?: ButtonSize;
  readonly trailingIcon?: ReactNode;
  readonly type?: "button" | "reset" | "submit";
  readonly variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  disabled = false,
  fullWidth = false,
  isLoading = false,
  leadingIcon,
  loadingLabel = "Loading",
  size = "medium",
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const unavailable = disabled || isLoading;

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={classNames(
        "gv-button",
        `gv-button--${variant}`,
        `gv-button--${size}`,
        fullWidth && "gv-button--full-width",
        className,
      )}
      data-loading={isLoading || undefined}
      disabled={unavailable}
      type={type}
    >
      {isLoading ? (
        <>
          <span aria-hidden="true" className="gv-button__spinner" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {variant === "destructive" ? (
            <span aria-hidden="true" className="gv-button__destructive-marker">
              !
            </span>
          ) : null}
          {leadingIcon ? (
            <span aria-hidden="true" className="gv-button__icon">
              {leadingIcon}
            </span>
          ) : null}
          <span>{children}</span>
          {trailingIcon ? (
            <span aria-hidden="true" className="gv-button__icon">
              {trailingIcon}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}
