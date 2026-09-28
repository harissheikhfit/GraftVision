import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface SharedDeviceIndicatorProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly label?: string;
}

export function SharedDeviceIndicator({
  action,
  className,
  description,
  label = "Shared device",
}: SharedDeviceIndicatorProps) {
  return (
    <aside aria-label="Shared-device context" className={classNames("gv-shared-device", className)}>
      <span aria-hidden="true" className="gv-shared-device__cue">
        ■
      </span>
      <span className="gv-shared-device__content">
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
      </span>
      {action ? <span className="gv-shared-device__action">{action}</span> : null}
    </aside>
  );
}
