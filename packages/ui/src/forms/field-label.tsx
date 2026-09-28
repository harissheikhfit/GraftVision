import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef, ReactNode } from "react";

export interface FieldLabelProps extends Omit<ComponentPropsWithRef<"label">, "htmlFor"> {
  readonly htmlFor: string;
  readonly optional?: boolean;
  readonly required?: boolean;
  readonly supportingText?: ReactNode;
}

export function FieldLabel({
  children,
  className,
  htmlFor,
  optional = false,
  required = false,
  supportingText,
  ...props
}: FieldLabelProps) {
  return (
    <label {...props} className={classNames("gv-field-label", className)} htmlFor={htmlFor}>
      <span>{children}</span>
      {required ? (
        <span className="gv-field-label__marker">
          <span aria-hidden="true"> *</span>
          <span className="gv-visually-hidden"> required</span>
        </span>
      ) : optional ? (
        <span className="gv-field-label__optional"> (optional)</span>
      ) : null}
      {supportingText ? <span className="gv-field-label__supporting">{supportingText}</span> : null}
    </label>
  );
}
