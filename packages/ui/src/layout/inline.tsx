import { classNames } from "../internal/class-names";

import type { LayoutAlignment, LayoutGap, LayoutJustification } from "./layout-types";
import type { ComponentPropsWithRef } from "react";

export interface InlineProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly align?: LayoutAlignment;
  readonly gap?: LayoutGap;
  readonly justify?: LayoutJustification;
  readonly wrap?: boolean;
}

export function Inline({
  align = "center",
  className,
  gap = "3",
  justify = "start",
  wrap = true,
  ...props
}: InlineProps) {
  return (
    <div
      {...props}
      className={classNames(
        "gv-inline",
        `gv-inline--align-${align}`,
        `gv-inline--justify-${justify}`,
        `gv-layout-gap--${gap}`,
        wrap && "gv-inline--wrap",
        className,
      )}
    />
  );
}
