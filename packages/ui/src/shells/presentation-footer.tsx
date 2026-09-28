import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface PresentationFooterProps {
  readonly className?: string;
  readonly controls?: ReactNode;
  readonly marker?: ReactNode;
  readonly supporting?: ReactNode;
}

export function PresentationFooter({
  className,
  controls,
  marker,
  supporting,
}: PresentationFooterProps) {
  return (
    <footer className={classNames("gv-presentation-footer", className)}>
      {supporting ? <div className="gv-presentation-footer__supporting">{supporting}</div> : null}
      {controls ? <div className="gv-presentation-footer__controls">{controls}</div> : null}
      {marker ? <div className="gv-presentation-footer__marker">{marker}</div> : null}
    </footer>
  );
}
