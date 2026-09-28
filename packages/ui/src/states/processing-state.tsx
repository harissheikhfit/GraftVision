import { StatePanel } from "./internal-state-display";
import { ProgressIndicator } from "./progress-indicator";

import type { StateHeadingLevel } from "./state-taxonomy";
import type { ReactNode } from "react";

export type ProcessingStatus = "completed" | "failed" | "processing" | "queued";

export interface ProcessingStateProps {
  readonly className?: string;
  readonly description: ReactNode;
  readonly headingLevel?: StateHeadingLevel;
  readonly progress?: number;
  readonly retryAction?: ReactNode;
  readonly safeWarning?: ReactNode;
  readonly stageLabel: string;
  readonly status?: ProcessingStatus;
}

const processingPresentation = {
  completed: { marker: "✓", tone: "success" },
  failed: { marker: "!", tone: "error" },
  processing: { marker: "→", tone: "information" },
  queued: { marker: "…", tone: "preliminary" },
} as const;

export function ProcessingState({
  className,
  description,
  headingLevel,
  progress,
  retryAction,
  safeWarning,
  stageLabel,
  status = "processing",
}: ProcessingStateProps) {
  const presentation = processingPresentation[status];
  const details = (
    <>
      {description}
      {progress !== undefined ? (
        <ProgressIndicator label={stageLabel} showValue value={progress} />
      ) : status === "processing" ? (
        <ProgressIndicator label={stageLabel} />
      ) : null}
      {safeWarning ? <span className="gv-state-panel__warning">{safeWarning}</span> : null}
    </>
  );

  return (
    <StatePanel
      action={status === "failed" ? retryAction : undefined}
      className={className}
      description={details}
      heading={stageLabel}
      headingLevel={headingLevel}
      live={status === "failed" ? "assertive" : "polite"}
      marker={presentation.marker}
      tone={presentation.tone}
    />
  );
}
