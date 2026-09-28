import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export type TextareaResize = "none" | "vertical";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  readonly isInvalid?: boolean;
  readonly resize?: TextareaResize;
}

export function Textarea({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  className,
  disabled,
  isInvalid = false,
  readOnly,
  required,
  resize = "vertical",
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-describedby={ariaDescribedBy}
      aria-invalid={isInvalid || ariaInvalid || undefined}
      aria-required={required || ariaRequired || undefined}
      className={classNames(
        "gv-textarea",
        `gv-textarea--resize-${resize}`,
        isInvalid && "gv-control--invalid",
        readOnly && "gv-control--read-only",
        className,
      )}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
    />
  );
}
