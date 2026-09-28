import { classNames } from "../internal/class-names";
import { PrivacyBadge, type PrivacyBadgeVariant } from "../states/privacy-badge";

import type { PrivacyContextLevel } from "./shell-types";
import type { ReactNode } from "react";

export interface PrivacyContextBarProps {
  readonly className?: string;
  readonly compact?: boolean;
  readonly description?: ReactNode;
  readonly level: PrivacyContextLevel;
}

const privacyLevelPresentation: Record<
  PrivacyContextLevel,
  { readonly badge: PrivacyBadgeVariant; readonly label: string }
> = {
  "internal-workspace": { badge: "internal", label: "Internal workspace" },
  "patient-safe": { badge: "patient-safe", label: "Patient-safe context" },
  "presentation-mode": { badge: "patient-safe", label: "Presentation mode" },
  restricted: { badge: "restricted", label: "Restricted context" },
  "temporary-access": { badge: "temporary-access", label: "Temporary access" },
};

export function PrivacyContextBar({
  className,
  compact = false,
  description,
  level,
}: PrivacyContextBarProps) {
  const presentation = privacyLevelPresentation[level];

  return (
    <aside
      aria-label="Privacy context"
      className={classNames(
        "gv-privacy-context",
        `gv-privacy-context--${level}`,
        compact && "gv-privacy-context--compact",
        className,
      )}
      data-privacy-level={level}
    >
      <PrivacyBadge compact={compact} variant={presentation.badge} />
      <span className="gv-privacy-context__label">{presentation.label}</span>
      {description ? <span className="gv-privacy-context__description">{description}</span> : null}
    </aside>
  );
}
