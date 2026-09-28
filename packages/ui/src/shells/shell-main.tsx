import { classNames } from "../internal/class-names";

import type { ShellContentWidth } from "./shell-types";
import type { ComponentPropsWithRef } from "react";

export interface ShellMainProps extends Omit<ComponentPropsWithRef<"main">, "style"> {
  readonly width?: ShellContentWidth;
}

export function ShellMain({
  className,
  id = "main-content",
  tabIndex = -1,
  width = "standard",
  ...props
}: ShellMainProps) {
  return (
    <main
      {...props}
      className={classNames("gv-shell-main", `gv-shell-main--${width}`, className)}
      id={id}
      tabIndex={tabIndex}
    />
  );
}
