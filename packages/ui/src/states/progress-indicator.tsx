import { classNames } from "../internal/class-names";

export interface ProgressStep {
  readonly current: number;
  readonly total: number;
}

export interface ProgressIndicatorProps {
  readonly className?: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly showValue?: boolean;
  readonly step?: ProgressStep;
  readonly value?: number;
  readonly variant?: "compact" | "full-width";
}

function normaliseRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new Error("ProgressIndicator requires a finite max greater than min.");
  }

  return { max, min };
}

export function ProgressIndicator({
  className,
  label,
  max = 100,
  min = 0,
  showValue = false,
  step,
  value,
  variant = "full-width",
}: ProgressIndicatorProps) {
  const range = normaliseRange(min, max);
  const determinate = value !== undefined;
  const safeValue = determinate
    ? Math.min(range.max, Math.max(range.min, Number.isFinite(value) ? value : range.min))
    : undefined;
  const percentage =
    safeValue === undefined
      ? undefined
      : Math.round(((safeValue - range.min) / (range.max - range.min)) * 100);

  if (
    step &&
    (!Number.isInteger(step.current) ||
      !Number.isInteger(step.total) ||
      step.current < 1 ||
      step.total < 1 ||
      step.current > step.total)
  ) {
    throw new Error("ProgressIndicator step values must be positive integers within range.");
  }

  return (
    <div
      className={classNames("gv-progress", `gv-progress--${variant}`, className)}
      data-determinate={determinate}
    >
      <div className="gv-progress__labels">
        <span>{label}</span>
        {step ? <span>{`Step ${step.current} of ${step.total}`}</span> : null}
        {showValue && percentage !== undefined ? <span>{percentage}%</span> : null}
      </div>
      <progress
        aria-label={label}
        aria-valuemax={range.max}
        aria-valuemin={range.min}
        aria-valuenow={safeValue}
        className="gv-progress__control"
        max={range.max - range.min}
        value={safeValue === undefined ? undefined : safeValue - range.min}
      />
    </div>
  );
}
