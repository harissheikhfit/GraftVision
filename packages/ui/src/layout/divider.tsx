import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface DividerProps {
  readonly className?: string;
  readonly decorative?: boolean;
  readonly label?: ReactNode;
  readonly orientation?: "horizontal" | "vertical";
  readonly spacing?: "compact" | "spacious";
}

export function Divider({
  className,
  decorative = false,
  label,
  orientation = "horizontal",
  spacing = "compact",
}: DividerProps) {
  if (orientation === "horizontal" && !label) {
    return (
      <hr
        aria-hidden={decorative || undefined}
        className={classNames("gv-divider", `gv-divider--${spacing}`, className)}
      />
    );
  }

  return (
    <div
      aria-hidden={decorative || undefined}
      aria-label={typeof label === "string" ? label : undefined}
      aria-orientation={orientation}
      className={classNames(
        "gv-divider",
        `gv-divider--${orientation}`,
        `gv-divider--${spacing}`,
        className,
      )}
      role={decorative ? "presentation" : "separator"}
    >
      {label ? <span className="gv-divider__label">{label}</span> : null}
    </div>
  );
}
