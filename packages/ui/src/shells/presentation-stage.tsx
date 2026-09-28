import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface PresentationStageProps {
  readonly className?: string;
  readonly mainVisual?: ReactNode;
  readonly marker?: ReactNode;
  readonly metrics?: ReactNode;
  readonly supporting?: ReactNode;
  readonly title: ReactNode;
}

export function PresentationStage({
  className,
  mainVisual,
  marker,
  metrics,
  supporting,
  title,
}: PresentationStageProps) {
  return (
    <section className={classNames("gv-presentation-stage", className)}>
      <h1>{title}</h1>
      {mainVisual ? <div className="gv-presentation-stage__visual">{mainVisual}</div> : null}
      {supporting ? <div className="gv-presentation-stage__supporting">{supporting}</div> : null}
      {metrics ? <div className="gv-presentation-stage__metrics">{metrics}</div> : null}
      {marker ? <div className="gv-presentation-stage__marker">{marker}</div> : null}
    </section>
  );
}
