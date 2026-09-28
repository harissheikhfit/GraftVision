export const clinicBrandColorOverrideTokens = [
  "--gv-brand-primary",
  "--gv-brand-secondary",
  "--gv-brand-link",
  "--gv-brand-selected-control",
] as const;

export const clinicBrandDefaultAccentValues = {
  link: "#155e75",
  primary: "#14532d",
  secondary: "#0f766e",
  selectedControl: "#166534",
} as const;

export const clinicBrandContentFields = ["clinicDisplayName", "clinicLogo"] as const;

export const deferredClinicBrandContentFields = [
  "approvedReportWording",
  "doctorSignatureAsset",
] as const;

export const protectedThemeTokenPrefixes = [
  "--gv-color-error",
  "--gv-color-warning",
  "--gv-color-success",
  "--gv-color-information",
  "--gv-color-restricted",
  "--gv-color-preliminary",
  "--gv-color-doctor-approved",
  "--gv-color-ai-assisted",
  "--gv-color-patient-safe",
  "--gv-color-internal",
  "--gv-color-focus",
  "--gv-color-disabled",
  "--gv-focus-",
  "--gv-border-error",
  "--gv-region-",
  "--gv-space-",
  "--gv-font-",
  "--gv-motion-",
  "--gv-layer-",
  "--gv-presentation-expired",
] as const;

export const clinicBrandValidationRules = {
  activation: {
    previewRequired: true,
    revertToDefaultRequired: true,
    unsafeColourRejected: true,
  },
  colours: {
    contrastTargets: {
      largeText: 3,
      normalText: 4.5,
      nonTextIndicator: 3,
    },
    maximumChroma: 0.28,
    requireDarkAndLightForegroundEvaluation: true,
  },
  logo: {
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maximumBytes: 2_097_152,
    maximumHeightPixels: 2048,
    maximumWidthPixels: 2048,
    minimumHeightPixels: 256,
    minimumWidthPixels: 256,
    preferredBackground: "transparent",
    rejectedFallback: "GraftVision default mark with clinic display name",
  },
} as const;

export function isClinicBrandColorOverrideAllowed(tokenName: string): boolean {
  return clinicBrandColorOverrideTokens.some((token) => token === tokenName);
}

export function isProtectedThemeToken(tokenName: string): boolean {
  return protectedThemeTokenPrefixes.some((prefix) => tokenName.startsWith(prefix));
}
