import { describe, expect, it } from "vitest";

import {
  accessibilityDesignContract,
  clinicBrandColorOverrideTokens,
  clinicBrandContentFields,
  presentationDesignContract,
  preservedDesignFoundation,
  protectedDesignMeanings,
  reportDesignContract,
} from "./index";

describe("UX-DESIGN-001 policy", () => {
  it("preserves the validated shared design foundation", () => {
    expect(preservedDesignFoundation).toEqual([
      "typography",
      "spacing",
      "radii",
      "shadows",
      "surfaces",
      "responsiveBreakpoints",
      "interactionStates",
      "presentationDensity",
    ]);
  });

  it("allows only bounded clinic identity and accent overrides", () => {
    expect(clinicBrandContentFields).toEqual(["clinicDisplayName", "clinicLogo"]);
    expect(clinicBrandColorOverrideTokens).toEqual([
      "--gv-brand-primary",
      "--gv-brand-secondary",
      "--gv-brand-link",
      "--gv-brand-selected-control",
    ]);
  });

  it("keeps every approved safety and clinical meaning protected", () => {
    expect(protectedDesignMeanings).toEqual([
      "error",
      "warning",
      "destructive",
      "privacy",
      "restricted",
      "lock",
      "focus",
      "doctorApproved",
      "patientSafe",
      "aiAssisted",
      "anatomical",
      "disabled",
      "invalid",
    ]);
  });

  it("records WCAG targets and required non-colour evidence", () => {
    expect(accessibilityDesignContract.standard).toBe("WCAG 2.2 AA");
    expect(accessibilityDesignContract.contrast).toEqual({
      essentialBoundary: 3,
      largeText: 3,
      normalText: 4.5,
    });
    expect(accessibilityDesignContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        "keyboard",
        "visibleFocus",
        "zoomReflow",
        "reducedMotion",
        "forcedColours",
        "colourVision",
        "grayscale",
        "print",
        "rtl",
        "nonColourCues",
      ]),
    );
  });

  it("protects report and presentation safety content in every fixture", () => {
    expect(reportDesignContract.validationContexts).toEqual(["screen", "print", "grayscale"]);
    expect(reportDesignContract.protectedContent).toEqual(
      expect.arrayContaining([
        "attribution",
        "disclosureClass",
        "approvalVersionState",
        "watermark",
        "disclaimer",
        "reportIdentity",
      ]),
    );
    expect(presentationDesignContract.aspectRatio).toBe("16:9");
    expect(presentationDesignContract.validationContexts).toEqual(
      expect.arrayContaining([
        "overscan",
        "distanceReadability",
        "lowContrastLed",
        "reducedMotion",
      ]),
    );
    expect(presentationDesignContract.neutralStateTriggers).toEqual(["revoked", "expired"]);
    expect(presentationDesignContract.protectedContent).toEqual(
      expect.arrayContaining(["attribution", "expiry", "lockState"]),
    );
  });
});
