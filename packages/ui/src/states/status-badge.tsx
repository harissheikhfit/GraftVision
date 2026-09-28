import { BadgeBase } from "./internal-state-display";

import type { ReactNode } from "react";

export type StatusBadgeVariant =
  | "approved"
  | "archived"
  | "completed"
  | "draft"
  | "expired"
  | "failed"
  | "in-progress"
  | "neutral"
  | "pending"
  | "rejected"
  | "restricted"
  | "review-required"
  | "revoked";

export interface StatusBadgeProps {
  readonly className?: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly size?: "medium" | "small";
  readonly variant?: StatusBadgeVariant;
}

const statusPresentation = {
  approved: { cue: "✓", tone: "doctor-approved" },
  archived: { cue: "□", tone: "internal" },
  completed: { cue: "✓", tone: "success" },
  draft: { cue: "D", tone: "preliminary" },
  expired: { cue: "⌛", tone: "warning" },
  failed: { cue: "!", tone: "error" },
  "in-progress": { cue: "→", tone: "information" },
  neutral: { cue: "•", tone: "internal" },
  pending: { cue: "…", tone: "preliminary" },
  rejected: { cue: "×", tone: "error" },
  restricted: { cue: "!", tone: "restricted" },
  "review-required": { cue: "!", tone: "preliminary" },
  revoked: { cue: "×", tone: "restricted" },
} as const;

export function StatusBadge({
  className,
  icon,
  label,
  size = "medium",
  variant = "neutral",
}: StatusBadgeProps) {
  if (label.trim().length === 0) {
    throw new Error("StatusBadge requires a non-empty text label.");
  }

  const presentation = statusPresentation[variant];

  return (
    <BadgeBase
      className={className}
      cue={presentation.cue}
      icon={icon}
      size={size}
      tone={presentation.tone}
    >
      {label}
    </BadgeBase>
  );
}
