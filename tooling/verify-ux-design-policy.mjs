import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(rootDirectory, relativePath), "utf8");
const readOptional = async (relativePath) => {
  try {
    return await read(relativePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

const [
  brandPolicy,
  designPolicy,
  designPolicyTests,
  tokens,
  foundations,
  primitives,
  shells,
  states,
  uiGuidelines,
  tasks,
  rootManifestSource,
] = await Promise.all([
  read("packages/ui/src/brand-boundaries.ts"),
  read("packages/ui/src/ux-design-policy.ts"),
  read("packages/ui/src/ux-design-policy.test.ts"),
  read("packages/ui/src/styles/tokens.css"),
  read("packages/ui/src/styles/foundations.css"),
  read("packages/ui/src/styles/primitives.css"),
  read("packages/ui/src/styles/shells.css"),
  read("packages/ui/src/styles/states.css"),
  readOptional("docs/UI_UX_GUIDELINES.md"),
  readOptional("docs/TASKS.md"),
  read("package.json"),
]);

const rootManifest = JSON.parse(rootManifestSource);
const allowedBrandTokens = [
  "--gv-brand-primary",
  "--gv-brand-secondary",
  "--gv-brand-link",
  "--gv-brand-selected-control",
];
const systemOwnedBrandTokens = [
  "--gv-brand-on-primary",
  "--gv-brand-on-secondary",
  "--gv-brand-report-accent",
  "--gv-brand-presentation-accent",
];

const allowlistMatch =
  /export const clinicBrandColorOverrideTokens = \[([\s\S]*?)\] as const;/u.exec(brandPolicy);
assert(allowlistMatch?.[1], "Clinic brand override allowlist is missing.");

for (const token of allowedBrandTokens) {
  assert(allowlistMatch[1].includes(`"${token}"`), `${token} must remain clinic-overridable.`);
  assert(tokens.includes(`${token}:`), `${token} must remain defined by the shared foundation.`);
}

for (const token of systemOwnedBrandTokens) {
  assert(!allowlistMatch[1].includes(`"${token}"`), `${token} must remain system-owned.`);
  assert(tokens.includes(`${token}:`), `${token} must remain available as a system-owned alias.`);
}

assert.equal(
  (allowlistMatch[1].match(/"--gv-[a-z0-9-]+"/gu) ?? []).length,
  4,
  "Exactly four clinic colour overrides are approved.",
);
assert(brandPolicy.includes('["clinicDisplayName", "clinicLogo"]'));

for (const prohibitedThemeCapability of [
  "arbitraryCss",
  "customFont",
  "gradient",
  "layoutOverride",
  "navigationOverride",
  "themeJson",
]) {
  assert(!brandPolicy.includes(`"${prohibitedThemeCapability}"`));
}

for (const foundation of [
  "typography",
  "spacing",
  "radii",
  "shadows",
  "surfaces",
  "responsiveBreakpoints",
  "interactionStates",
  "presentationDensity",
]) {
  assert(designPolicy.includes(`"${foundation}"`), `Missing preserved foundation: ${foundation}.`);
}

for (const meaning of [
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
]) {
  assert(designPolicy.includes(`"${meaning}"`), `Missing protected meaning: ${meaning}.`);
}

assert(designPolicy.includes('standard: "WCAG 2.2 AA"'));
assert(designPolicy.includes("normalText: 4.5"));
assert(designPolicy.includes("largeText: 3"));
assert(designPolicy.includes("essentialBoundary: 3"));

for (const evidence of [
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
]) {
  assert(designPolicy.includes(`"${evidence}"`), `Missing accessibility evidence: ${evidence}.`);
}

assert(foundations.includes(":focus-visible"));
assert(foundations.includes("@media (prefers-reduced-motion: reduce)"));
assert(foundations.includes("@media (forced-colors: active)"));
assert(primitives.includes("var(--gv-brand-selected-control)"));
assert(!states.includes("--gv-brand-"), "Protected state CSS cannot consume clinic brand tokens.");
assert(shells.includes("calc(100dvh * 16 / 9)"));
assert(shells.includes("max-inline-size: 120rem"));
assert(shells.includes("env(safe-area-inset-bottom)"));
assert(shells.includes("var(--gv-presentation-expired-background)"));
assert(shells.includes("@media (prefers-reduced-motion: no-preference)"));
assert(shells.includes("@media (forced-colors: active)"));

for (const reportToken of [
  "--gv-report-background",
  "--gv-report-text",
  "--gv-report-rule",
  "--gv-brand-report-accent",
]) {
  assert(tokens.includes(`${reportToken}:`), `Missing report fixture token: ${reportToken}.`);
}

for (const protectedContent of [
  "attribution",
  "disclosureClass",
  "approvalVersionState",
  "watermark",
  "disclaimer",
  "reportIdentity",
  "expiry",
  "lockState",
]) {
  assert(
    designPolicy.includes(`"${protectedContent}"`),
    `Missing protected output content: ${protectedContent}.`,
  );
}

for (const fixture of [
  "screen",
  "print",
  "grayscale",
  "overscan",
  "distanceReadability",
  "lowContrastLed",
  "reducedMotion",
]) {
  assert(designPolicy.includes(`"${fixture}"`), `Missing output fixture: ${fixture}.`);
}

assert(designPolicyTests.includes('aspectRatio).toBe("16:9")'));
assert(designPolicyTests.includes('neutralStateTriggers).toEqual(["revoked", "expired"])'));
assert(designPolicyTests.includes('"nonColourCues"'));

for (const stylesheet of [foundations, primitives, shells, states]) {
  assert(!/\b(?:margin|padding|border)-(?:left|right)\b/iu.test(stylesheet));
}

if (uiGuidelines !== undefined && tasks !== undefined) {
  assert(uiGuidelines.includes("### UX-DESIGN-001 approved technical decision"));
  assert(
    uiGuidelines.includes("Technical validation evidence does not complete manual approvals."),
  );
  assert(tasks.includes("#### UX-DESIGN-001 technical decision"));
  assert(tasks.includes("External human approval remains separate and incomplete."));

  for (const approvalLine of uiGuidelines.match(/^- \[[ x]\] .+approv/gimu) ?? []) {
    assert(approvalLine.startsWith("- [ ]"), "UX-DESIGN-001 must not complete human approvals.");
  }
}

assert.equal(
  rootManifest.scripts["verify:ux-design-policy"],
  "node tooling/verify-ux-design-policy.mjs",
);
assert(rootManifest.scripts.check.includes("node tooling/verify-ux-design-policy.mjs"));

console.log(
  "UX-DESIGN-001 policy passed: the validated foundation is preserved; four clinic accents and " +
    "bounded identity are allowed; protected meanings, WCAG targets, report/print and " +
    "presentation/LED constraints remain system-owned; manual approvals remain separate.",
);
