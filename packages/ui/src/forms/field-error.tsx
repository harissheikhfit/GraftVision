import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export type FieldErrorLiveMode = "assertive" | "off" | "polite";

export interface FieldErrorProps extends Omit<ComponentPropsWithRef<"p">, "id"> {
  readonly id: string;
  readonly live?: FieldErrorLiveMode;
}

export function FieldError({ children, className, id, live = "off", ...props }: FieldErrorProps) {
  return (
    <p
      {...props}
      aria-live={live === "off" ? undefined : live}
      className={classNames("gv-field-error", className)}
      id={id}
    >
      <span aria-hidden="true" className="gv-field-error__marker">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}
