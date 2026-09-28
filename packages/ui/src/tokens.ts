/**
 * Stable metadata for the proposed GraftVision token contract.
 * CSS remains the runtime source of values; this module exposes names, roles, and validation intent.
 */
export const semanticColorTokens = [
  "--gv-color-background",
  "--gv-color-surface",
  "--gv-color-surface-elevated",
  "--gv-color-border",
  "--gv-color-border-strong",
  "--gv-color-text-primary",
  "--gv-color-text-secondary",
  "--gv-color-text-muted",
  "--gv-color-link",
  "--gv-color-focus",
  "--gv-color-success-surface",
  "--gv-color-success-text",
  "--gv-color-warning-surface",
  "--gv-color-warning-text",
  "--gv-color-error-surface",
  "--gv-color-error-text",
  "--gv-color-information-surface",
  "--gv-color-information-text",
  "--gv-color-restricted-surface",
  "--gv-color-restricted-text",
  "--gv-color-preliminary-surface",
  "--gv-color-preliminary-text",
  "--gv-color-doctor-approved-surface",
  "--gv-color-doctor-approved-text",
  "--gv-color-ai-assisted-surface",
  "--gv-color-ai-assisted-text",
  "--gv-color-patient-safe-surface",
  "--gv-color-patient-safe-text",
  "--gv-color-internal-surface",
  "--gv-color-internal-text",
  "--gv-color-disabled-surface",
  "--gv-color-disabled-text",
  "--gv-color-selection",
  "--gv-color-selection-text",
] as const;

export const typographyRoles = {
  body: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-body",
    weight: "--gv-font-weight-regular",
  },
  bodyStrong: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-body",
    weight: "--gv-font-weight-semibold",
  },
  caption: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-caption",
    weight: "--gv-font-weight-regular",
  },
  cardTitle: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-card-title",
    weight: "--gv-font-weight-semibold",
  },
  clinicalAnnotation: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-label",
    weight: "--gv-font-weight-medium",
  },
  dataValue: {
    family: "--gv-font-family-mono",
    size: "--gv-font-size-body",
    weight: "--gv-font-weight-semibold",
  },
  display: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-display",
    weight: "--gv-font-weight-bold",
  },
  label: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-label",
    weight: "--gv-font-weight-semibold",
  },
  pageTitle: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-page-title",
    weight: "--gv-font-weight-bold",
  },
  sectionTitle: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-section-title",
    weight: "--gv-font-weight-semibold",
  },
  tableText: {
    family: "--gv-font-family-sans",
    size: "--gv-font-size-label",
    weight: "--gv-font-weight-regular",
  },
  technicalValue: {
    family: "--gv-font-family-mono",
    size: "--gv-font-size-label",
    weight: "--gv-font-weight-medium",
  },
} as const;

export const anatomicalRegionTokens = [
  {
    label: "Frontal zone",
    cssVariable: "--gv-region-frontal",
    visualCue: "solid outline + FR label",
  },
  {
    label: "Mid-scalp",
    cssVariable: "--gv-region-mid-scalp",
    visualCue: "diagonal pattern + MID label",
  },
  {
    label: "Crown",
    cssVariable: "--gv-region-crown",
    visualCue: "dot pattern + CR label",
  },
  {
    label: "Left temple",
    cssVariable: "--gv-region-left-temple",
    visualCue: "left hatch + explicit LEFT label",
  },
  {
    label: "Right temple",
    cssVariable: "--gv-region-right-temple",
    visualCue: "right hatch + explicit RIGHT label",
  },
  {
    label: "Donor area",
    cssVariable: "--gv-region-donor-area",
    visualCue: "cross hatch + DONOR label",
  },
  {
    label: "Existing hair",
    cssVariable: "--gv-region-existing-hair",
    visualCue: "fine solid line + EXISTING legend",
  },
  {
    label: "Proposed hairline",
    cssVariable: "--gv-region-proposed-hairline",
    visualCue: "bold line + PROPOSED legend",
  },
  {
    label: "AI-suggested region",
    cssVariable: "--gv-region-ai-suggested",
    visualCue: "dashed outline + AI ASSISTED label and icon",
  },
  {
    label: "Doctor-approved region",
    cssVariable: "--gv-region-doctor-approved",
    visualCue: "double outline + DOCTOR APPROVED label and icon",
  },
  {
    label: "Superseded region",
    cssVariable: "--gv-region-superseded",
    visualCue: "strike pattern + SUPERSEDED label",
  },
] as const;

export const breakpointTokens = {
  desktop: { minWidthRem: 64, cssVariable: "--gv-breakpoint-desktop" },
  mobile: { minWidthRem: 40, cssVariable: "--gv-breakpoint-mobile" },
  presentation: { minWidthRem: 120, cssVariable: "--gv-breakpoint-presentation" },
  smallMobile: { minWidthRem: 22.5, cssVariable: "--gv-breakpoint-small-mobile" },
  tablet: { minWidthRem: 48, cssVariable: "--gv-breakpoint-tablet" },
  wideDesktop: { minWidthRem: 90, cssVariable: "--gv-breakpoint-wide" },
} as const;

export const densityTokens = {
  comfortable: {
    controlHeight: "--gv-control-height-comfortable",
    gap: "--gv-density-comfortable-gap",
  },
  compact: {
    controlHeight: "--gv-control-height-compact",
    gap: "--gv-density-compact-gap",
  },
  presentation: {
    controlHeight: "--gv-control-height-presentation",
    gap: "--gv-density-presentation-gap",
  },
} as const;

export const surfaceTokenGroups = {
  clinicDashboard: [
    "--gv-dashboard-background",
    "--gv-dashboard-surface",
    "--gv-color-restricted-surface",
    "--gv-color-doctor-approved-surface",
  ],
  mobileScan: [
    "--gv-scan-background",
    "--gv-scan-surface",
    "--gv-scan-overlay",
    "--gv-scan-connectivity",
    "--gv-touch-target-minimum",
  ],
  patientPresentation: [
    "--gv-presentation-background",
    "--gv-presentation-surface",
    "--gv-presentation-text",
    "--gv-presentation-text-muted",
    "--gv-presentation-accent",
    "--gv-presentation-expired-background",
    "--gv-presentation-expired-text",
  ],
  publicWebsite: ["--gv-public-background", "--gv-color-text-primary", "--gv-brand-primary"],
  report: [
    "--gv-report-background",
    "--gv-report-text",
    "--gv-report-rule",
    "--gv-brand-report-accent",
  ],
} as const;

export const focusTokens = [
  "--gv-color-focus",
  "--gv-color-focus-contrast",
  "--gv-focus-width",
  "--gv-focus-offset",
  "--gv-focus-outline",
  "--gv-focus-outline-high-contrast",
] as const;

export const reducedMotionTokens = [
  "--gv-motion-reduced-duration",
  "--gv-motion-duration-fast",
  "--gv-motion-duration-standard",
  "--gv-motion-duration-slow",
  "--gv-motion-easing-standard",
] as const;

export type SemanticColorToken = (typeof semanticColorTokens)[number];
