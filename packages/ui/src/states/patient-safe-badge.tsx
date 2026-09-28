import { BadgeBase } from "./internal-state-display";

export interface PatientSafeBadgeProps {
  readonly approved?: boolean;
  readonly className?: string;
}

export function PatientSafeBadge({ approved = false, className }: PatientSafeBadgeProps) {
  return (
    <BadgeBase className={className} cue="P" tone="patient-safe">
      Patient safe{approved ? " — approved" : ""}
    </BadgeBase>
  );
}
