import { BadgeBase } from "./internal-state-display";

export interface AIAssistedBadgeProps {
  readonly className?: string;
  readonly confidence?: string;
  readonly uncertain?: boolean;
}

export function AIAssistedBadge({
  className,
  confidence,
  uncertain = false,
}: AIAssistedBadgeProps) {
  return (
    <BadgeBase className={className} cue="AI" tone="ai-assisted">
      AI-assisted
      {confidence ? ` — ${confidence}` : ""}
      {uncertain ? " — uncertainty noted" : ""}
    </BadgeBase>
  );
}
