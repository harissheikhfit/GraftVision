import { classNames } from "../internal/class-names";

export type LoadingIndicatorSize = "large" | "medium" | "small";

export interface LoadingIndicatorProps {
  readonly className?: string;
  readonly decorative?: boolean;
  readonly label?: string;
  readonly size?: LoadingIndicatorSize;
}

export function LoadingIndicator({
  className,
  decorative = false,
  label = "Loading",
  size = "medium",
}: LoadingIndicatorProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      className={classNames("gv-loading-indicator", `gv-loading-indicator--${size}`, className)}
      role={decorative ? undefined : "status"}
    >
      <span aria-hidden="true" className="gv-loading-indicator__shape" />
    </span>
  );
}
