export const preservedDesignFoundation = [
  "typography",
  "spacing",
  "radii",
  "shadows",
  "surfaces",
  "responsiveBreakpoints",
  "interactionStates",
  "presentationDensity",
] as const;

export const protectedDesignMeanings = [
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
] as const;

export const accessibilityDesignContract = {
  contrast: {
    essentialBoundary: 3,
    largeText: 3,
    normalText: 4.5,
  },
  requiredEvidence: [
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
  ],
  standard: "WCAG 2.2 AA",
} as const;

export const reportDesignContract = {
  protectedContent: [
    "attribution",
    "disclosureClass",
    "approvalVersionState",
    "watermark",
    "disclaimer",
    "reportIdentity",
  ],
  validationContexts: ["screen", "print", "grayscale"],
} as const;

export const presentationDesignContract = {
  aspectRatio: "16:9",
  neutralStateTriggers: ["revoked", "expired"],
  protectedContent: [
    "attribution",
    "disclosureClass",
    "approvalVersionState",
    "expiry",
    "lockState",
  ],
  validationContexts: ["overscan", "distanceReadability", "lowContrastLed", "reducedMotion"],
} as const;
