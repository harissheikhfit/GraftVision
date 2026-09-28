import { classNames } from "../internal/class-names";

import type { ComponentPropsWithRef } from "react";

export interface ShellContentProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly density?: "comfortable" | "compact" | "presentation";
}

export function ShellContent({ className, density = "comfortable", ...props }: ShellContentProps) {
  return (
    <div
      {...props}
      className={classNames("gv-shell-content", `gv-shell-content--density-${density}`, className)}
    />
  );
}
