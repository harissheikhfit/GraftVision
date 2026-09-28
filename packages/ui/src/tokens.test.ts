import { describe, expect, it } from "vitest";

import {
  anatomicalRegionTokens,
  breakpointTokens,
  densityTokens,
  focusTokens,
  reducedMotionTokens,
  semanticColorTokens,
  surfaceTokenGroups,
  typographyRoles,
} from "./tokens";

describe("UI token metadata", () => {
  it("uses unique semantic and anatomical token names", () => {
    const allNames = [
      ...semanticColorTokens,
      ...anatomicalRegionTokens.map(({ cssVariable }) => cssVariable),
    ];

    expect(new Set(allNames).size).toBe(allNames.length);
    expect(new Set(anatomicalRegionTokens.map(({ cssVariable }) => cssVariable)).size).toBe(
      anatomicalRegionTokens.length,
    );
  });

  it("defines every required typography role without external font assets", () => {
    expect(Object.keys(typographyRoles)).toEqual(
      expect.arrayContaining([
        "body",
        "bodyStrong",
        "caption",
        "cardTitle",
        "clinicalAnnotation",
        "dataValue",
        "display",
        "label",
        "pageTitle",
        "sectionTitle",
        "tableText",
        "technicalValue",
      ]),
    );

    for (const role of Object.values(typographyRoles)) {
      expect(role.family).toMatch(/^--gv-font-family-/);
      expect(role.size).toMatch(/^--gv-font-size-/);
      expect(role.weight).toMatch(/^--gv-font-weight-/);
    }
  });

  it("retains non-colour cues for every anatomical and planning role", () => {
    for (const region of anatomicalRegionTokens) {
      expect(region.label.length).toBeGreaterThan(2);
      expect(region.visualCue).toMatch(/label|legend/i);
    }
  });

  it("defines focus, reduced-motion, presentation, density, and breakpoint contracts", () => {
    expect(focusTokens).toEqual(
      expect.arrayContaining(["--gv-color-focus", "--gv-focus-outline-high-contrast"]),
    );
    expect(reducedMotionTokens).toContain("--gv-motion-reduced-duration");
    expect(surfaceTokenGroups.patientPresentation).toEqual(
      expect.arrayContaining([
        "--gv-presentation-background",
        "--gv-presentation-text",
        "--gv-presentation-expired-background",
      ]),
    );
    expect(Object.keys(densityTokens)).toEqual(["comfortable", "compact", "presentation"]);
    expect(breakpointTokens.presentation.minWidthRem).toBeGreaterThan(
      breakpointTokens.wideDesktop.minWidthRem,
    );
  });

  it("contains required protected state roles", () => {
    for (const state of [
      "success",
      "warning",
      "error",
      "information",
      "restricted",
      "preliminary",
      "doctor-approved",
      "ai-assisted",
      "patient-safe",
      "internal",
    ]) {
      expect(semanticColorTokens).toContain(`--gv-color-${state}-surface`);
      expect(semanticColorTokens).toContain(`--gv-color-${state}-text`);
    }
  });
});
