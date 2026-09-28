import { classNames } from "../internal/class-names";

export type SkeletonShape = "block" | "circle" | "text";

export interface SkeletonProps {
  readonly className?: string;
  readonly labelledBy?: string;
  readonly lines?: number;
  readonly loadingLabel?: string;
  readonly shape?: SkeletonShape;
}

export function Skeleton({
  className,
  labelledBy,
  lines = 1,
  loadingLabel,
  shape = "text",
}: SkeletonProps) {
  const safeLines = Math.min(10, Math.max(1, Math.trunc(lines)));
  const shapes = Array.from({ length: safeLines }, (_, index) => (
    <span
      aria-hidden="true"
      className={classNames("gv-skeleton__shape", `gv-skeleton__shape--${shape}`)}
      key={`${shape}-${index + 1}`}
    />
  ));

  if (loadingLabel || labelledBy) {
    return (
      <span
        aria-label={loadingLabel}
        aria-labelledby={labelledBy}
        className={classNames("gv-skeleton", className)}
        role="status"
      >
        {shapes}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={classNames("gv-skeleton", className)}>
      {shapes}
    </span>
  );
}
