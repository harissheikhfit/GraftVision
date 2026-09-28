import { BadgeBase } from "./internal-state-display";

export type ApprovalBadgeVariant =
  "amended" | "doctor-approved" | "draft" | "rejected" | "review-required" | "superseded";

export interface ApprovalBadgeProps {
  readonly approvedBy?: string;
  readonly className?: string;
  readonly variant: ApprovalBadgeVariant;
  readonly versionLabel?: string;
}

const approvalPresentation = {
  amended: { cue: "A", label: "Amended", tone: "warning" },
  "doctor-approved": { cue: "✓", label: "Doctor approved", tone: "doctor-approved" },
  draft: { cue: "D", label: "Draft", tone: "preliminary" },
  rejected: { cue: "×", label: "Rejected", tone: "error" },
  "review-required": { cue: "!", label: "Review required", tone: "preliminary" },
  superseded: { cue: "S", label: "Superseded", tone: "internal" },
} as const;

export function ApprovalBadge({
  approvedBy,
  className,
  variant,
  versionLabel,
}: ApprovalBadgeProps) {
  const presentation = approvalPresentation[variant];
  const details = [
    versionLabel,
    variant === "doctor-approved" && approvedBy ? `approved by ${approvedBy}` : undefined,
  ].filter(Boolean);

  return (
    <BadgeBase className={className} cue={presentation.cue} tone={presentation.tone}>
      {presentation.label}
      {details.length > 0 ? ` — ${details.join(", ")}` : ""}
    </BadgeBase>
  );
}
