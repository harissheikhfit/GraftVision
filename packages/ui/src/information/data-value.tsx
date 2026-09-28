import { useId } from "react";

import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface DataValueProps {
  readonly className?: string;
  readonly emptyValue?: string;
  readonly label: ReactNode;
  readonly monospace?: boolean;
  readonly preliminaryMarker?: ReactNode;
  readonly size?: "compact" | "large";
  readonly status?: ReactNode;
  readonly supportingText?: ReactNode;
  readonly unit?: ReactNode;
  readonly value?: ReactNode;
}

export function DataValue({
  className,
  emptyValue = "Not provided",
  label,
  monospace = false,
  preliminaryMarker,
  size = "compact",
  status,
  supportingText,
  unit,
  value,
}: DataValueProps) {
  const generatedId = useId();
  const labelId = `gv-data-value-${generatedId}-label`;

  return (
    <div
      aria-labelledby={labelId}
      className={classNames(
        "gv-data-value",
        `gv-data-value--${size}`,
        monospace && "gv-data-value--monospace",
        className,
      )}
    >
      <div className="gv-data-value__label" id={labelId}>
        {label}
        {preliminaryMarker}
        {status}
      </div>
      <div className="gv-data-value__value">
        <span>{value === undefined || value === null ? emptyValue : value}</span>
        {unit ? <span className="gv-data-value__unit">{unit}</span> : null}
      </div>
      {supportingText ? <div className="gv-data-value__supporting">{supportingText}</div> : null}
    </div>
  );
}
