import { BadgeBase } from "./internal-state-display";

export interface RestrictedBadgeProps {
  readonly className?: string;
  readonly reason?: string;
}

export function RestrictedBadge({ className, reason }: RestrictedBadgeProps) {
  return (
    <BadgeBase className={className} cue="!" tone="restricted">
      Restricted{reason ? ` — ${reason}` : ""}
    </BadgeBase>
  );
}
