import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface ReferenceValueProps {
  readonly accessibleLabel: string;
  readonly accessibleValue?: string;
  readonly className?: string;
  readonly copyAction?: ReactNode;
  readonly reference: string;
  readonly truncate?: boolean;
}

export function ReferenceValue({
  accessibleLabel,
  accessibleValue,
  className,
  copyAction,
  reference,
  truncate = false,
}: ReferenceValueProps) {
  return (
    <span className={classNames("gv-reference-value", className)}>
      <code
        aria-label={`${accessibleLabel}: ${accessibleValue ?? reference}`}
        className={classNames(
          "gv-reference-value__code",
          truncate && "gv-reference-value__code--truncate",
        )}
      >
        {reference}
      </code>
      {copyAction ? <span className="gv-reference-value__action">{copyAction}</span> : null}
    </span>
  );
}
