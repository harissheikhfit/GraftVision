import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export type ContainerSize = "full" | "narrow" | "standard" | "wide";

export interface ContainerProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly centered?: boolean;
  readonly padded?: boolean;
  readonly size?: ContainerSize;
}

export function Container({
  centered = true,
  className,
  padded = true,
  size = "standard",
  ...props
}: ContainerProps) {
  return (
    <div
      {...props}
      className={classNames(
        "gv-container",
        `gv-container--${size}`,
        centered && "gv-container--centered",
        padded && "gv-container--padded",
        className,
      )}
    />
  );
}
