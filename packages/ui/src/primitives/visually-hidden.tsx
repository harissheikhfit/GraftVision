import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export type VisuallyHiddenProps = ComponentPropsWithRef<"span">;

export function VisuallyHidden({ className, ...props }: VisuallyHiddenProps) {
  return <span {...props} className={classNames("gv-visually-hidden", className)} />;
}
