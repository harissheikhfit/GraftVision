import { describe, expect, it } from "vitest";

import {
  clinicBrandColorOverrideTokens,
  clinicBrandContentFields,
  clinicBrandDefaultAccentValues,
  clinicBrandValidationRules,
  deferredClinicBrandContentFields,
  isClinicBrandColorOverrideAllowed,
  isProtectedThemeToken,
  protectedThemeTokenPrefixes,
} from "./brand-boundaries";

describe("clinic brand boundaries", () => {
  it("allows only the narrow brand colour contract", () => {
    expect(Object.keys(clinicBrandDefaultAccentValues)).toEqual([
      "link",
      "primary",
      "secondary",
      "selectedControl",
    ]);
    expect(clinicBrandColorOverrideTokens).toEqual([
      "--gv-brand-primary",
      "--gv-brand-secondary",
      "--gv-brand-link",
      "--gv-brand-selected-control",
    ]);
    expect(new Set(clinicBrandColorOverrideTokens).size).toBe(
      clinicBrandColorOverrideTokens.length,
    );

    for (const token of clinicBrandColorOverrideTokens) {
      expect(isClinicBrandColorOverrideAllowed(token)).toBe(true);
      expect(isProtectedThemeToken(token)).toBe(false);
    }

    expect(isClinicBrandColorOverrideAllowed("--gv-color-error-text")).toBe(false);
    expect(isClinicBrandColorOverrideAllowed("--gv-region-crown")).toBe(false);
    expect(isClinicBrandColorOverrideAllowed("--gv-brand-on-primary")).toBe(false);
    expect(isClinicBrandColorOverrideAllowed("--gv-brand-report-accent")).toBe(false);
    expect(isClinicBrandColorOverrideAllowed("--gv-brand-presentation-accent")).toBe(false);
  });

  it("protects safety, clinical, privacy, focus, layout, and motion meanings", () => {
    for (const token of [
      "--gv-color-error-text",
      "--gv-color-warning-surface",
      "--gv-color-doctor-approved-border",
      "--gv-color-ai-assisted-text",
      "--gv-color-patient-safe-surface",
      "--gv-color-restricted-text",
      "--gv-color-focus",
      "--gv-color-disabled-text",
      "--gv-focus-outline",
      "--gv-border-error",
      "--gv-region-frontal",
      "--gv-space-4",
      "--gv-font-size-body",
      "--gv-motion-duration-fast",
      "--gv-layer-modal",
      "--gv-presentation-expired-background",
    ]) {
      expect(isProtectedThemeToken(token)).toBe(true);
    }

    expect(protectedThemeTokenPrefixes.length).toBeGreaterThan(10);
  });

  it("defines safe preview, fallback, logo, and contrast validation", () => {
    expect(clinicBrandValidationRules.activation).toEqual({
      previewRequired: true,
      revertToDefaultRequired: true,
      unsafeColourRejected: true,
    });
    expect(clinicBrandValidationRules.colours.contrastTargets.normalText).toBe(4.5);
    expect(clinicBrandValidationRules.colours.contrastTargets.nonTextIndicator).toBe(3);
    expect(clinicBrandValidationRules.colours.maximumChroma).toBeLessThanOrEqual(0.3);
    expect(clinicBrandValidationRules.logo.maximumBytes).toBe(2_097_152);
    expect(clinicBrandValidationRules.logo.minimumHeightPixels).toBe(256);
    expect(clinicBrandValidationRules.logo.minimumWidthPixels).toBe(256);
    expect(clinicBrandValidationRules.logo.maximumHeightPixels).toBe(2048);
    expect(clinicBrandValidationRules.logo.maximumWidthPixels).toBeLessThanOrEqual(2048);
    expect(clinicBrandValidationRules.logo.preferredBackground).toBe("transparent");
    expect(clinicBrandValidationRules.logo.rejectedFallback).toContain("GraftVision");
  });

  it("keeps content branding bounded and defers unimplemented assets", () => {
    expect(clinicBrandContentFields).toEqual(["clinicDisplayName", "clinicLogo"]);
    expect(deferredClinicBrandContentFields).toEqual([
      "approvedReportWording",
      "doctorSignatureAsset",
    ]);
  });
});
