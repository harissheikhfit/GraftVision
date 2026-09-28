import { classNames } from "../internal/class-names";

import type { LayoutAlignment, LayoutDensity, LayoutGap } from "./layout-types";
import type { ComponentPropsWithRef } from "react";

export interface StackProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly align?: LayoutAlignment;
  readonly density?: LayoutDensity;
  readonly fullWidth?: boolean;
  readonly gap?: LayoutGap;
}

export function Stack({
  align = "stretch",
  className,
  density = "comfortable",
  fullWidth = false,
  gap,
  ...props
}: StackProps) {
  const resolvedGap = gap ?? (density === "compact" ? "2" : density === "presentation" ? "6" : "4");

  return (
    <div
      {...props}
      className={classNames(
        "gv-stack",
        `gv-stack--align-${align}`,
        `gv-stack--density-${density}`,
        `gv-layout-gap--${resolvedGap}`,
        fullWidth && "gv-stack--full-width",
        className,
      )}
    />
  );
}
