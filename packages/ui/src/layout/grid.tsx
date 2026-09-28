import { classNames } from "../internal/class-names";

import type { LayoutGap } from "./layout-types";
import type { ComponentPropsWithRef } from "react";

export type GridColumns = 1 | 2 | 3 | 4;

export interface GridProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly columns?: GridColumns;
  readonly gap?: LayoutGap;
  readonly minimumItemWidth?: "medium" | "small" | "wide";
}

export function Grid({
  className,
  columns = 2,
  gap = "4",
  minimumItemWidth = "medium",
  ...props
}: GridProps) {
  return (
    <div
      {...props}
      className={classNames(
        "gv-grid",
        `gv-grid--columns-${columns}`,
        `gv-grid--minimum-${minimumItemWidth}`,
        `gv-layout-gap--${gap}`,
        className,
      )}
    />
  );
}
