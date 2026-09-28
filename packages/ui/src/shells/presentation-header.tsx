import { classNames } from "../internal/class-names";
import { PrivacyBadge } from "../states/privacy-badge";

import type { ReactNode } from "react";

export interface PresentationHeaderProps {
  readonly className?: string;
  readonly identity?: ReactNode;
  readonly indicator?: ReactNode;
  readonly title?: ReactNode;
}

export function PresentationHeader({
  className,
  identity = "GraftVision Present",
  indicator,
  title,
}: PresentationHeaderProps) {
  return (
    <header className={classNames("gv-presentation-header", className)}>
      <div className="gv-presentation-header__identity">{identity}</div>
      {title ? <div className="gv-presentation-header__title">{title}</div> : null}
      <div className="gv-presentation-header__indicator">
        {indicator ?? <PrivacyBadge variant="patient-safe" />}
      </div>
    </header>
  );
}
