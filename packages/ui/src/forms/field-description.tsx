import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export interface FieldDescriptionProps extends Omit<ComponentPropsWithRef<"p">, "id"> {
  readonly id: string;
}

export function FieldDescription({ className, id, ...props }: FieldDescriptionProps) {
  return <p {...props} className={classNames("gv-field-description", className)} id={id} />;
}
