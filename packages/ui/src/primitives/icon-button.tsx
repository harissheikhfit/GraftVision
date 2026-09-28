import { classNames } from "../internal/class-names";

import type { ButtonSize, ButtonVariant } from "./button";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface IconButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "aria-label" | "children" | "disabled" | "type"
> {
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly isLoading?: boolean;
  readonly label: string;
  readonly loadingLabel?: string;
  readonly size?: ButtonSize;
  readonly type?: "button" | "reset" | "submit";
  readonly variant?: ButtonVariant;
}

export function IconButton({
  className,
  disabled = false,
  icon,
  isLoading = false,
  label,
  loadingLabel = "Loading",
  size = "medium",
  type = "button",
  variant = "quiet",
  ...props
}: IconButtonProps) {
  if (label.trim().length === 0) {
    throw new Error("IconButton requires a non-empty accessible label.");
  }

  const unavailable = disabled || isLoading;

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      aria-label={isLoading ? `${label}: ${loadingLabel}` : label}
      className={classNames(
        "gv-icon-button",
        `gv-icon-button--${variant}`,
        `gv-icon-button--${size}`,
        className,
      )}
      data-loading={isLoading || undefined}
      disabled={unavailable}
      type={type}
    >
      {isLoading ? (
        <span aria-hidden="true" className="gv-button__spinner" />
      ) : (
        <span aria-hidden="true">{icon}</span>
      )}
    </button>
  );
}
