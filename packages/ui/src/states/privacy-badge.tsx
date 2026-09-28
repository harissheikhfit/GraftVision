import { BadgeBase } from "./internal-state-display";

export type PrivacyBadgeVariant =
  | "approved-for-sharing"
  | "doctor-only"
  | "internal"
  | "masked"
  | "patient-safe"
  | "restricted"
  | "temporary-access";

export interface PrivacyBadgeProps {
  readonly className?: string;
  readonly compact?: boolean;
  readonly description?: string;
  readonly variant: PrivacyBadgeVariant;
}

const privacyPresentation = {
  "approved-for-sharing": {
    compact: "Shareable",
    cue: "✓",
    full: "Approved for sharing",
    tone: "success",
  },
  "doctor-only": { compact: "Doctor only", cue: "D", full: "Doctor only", tone: "restricted" },
  internal: { compact: "Internal", cue: "I", full: "Internal", tone: "internal" },
  masked: { compact: "Masked", cue: "M", full: "Masked", tone: "internal" },
  "patient-safe": { compact: "Patient safe", cue: "P", full: "Patient safe", tone: "patient-safe" },
  restricted: { compact: "Restricted", cue: "!", full: "Restricted", tone: "restricted" },
  "temporary-access": { compact: "Temporary", cue: "T", full: "Temporary access", tone: "warning" },
} as const;

export function PrivacyBadge({
  className,
  compact = false,
  description,
  variant,
}: PrivacyBadgeProps) {
  const presentation = privacyPresentation[variant];

  return (
    <BadgeBase
      className={className}
      cue={presentation.cue}
      description={description}
      size={compact ? "small" : "medium"}
      tone={presentation.tone}
    >
      {compact ? presentation.compact : presentation.full}
    </BadgeBase>
  );
}
