import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readClinicOnboarding } from "@graftvision/database";
import {
  ClinicShell,
  Grid,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
  StatusBadge,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../session-activity-boundary";

import { ClinicOnboardingForm } from "./clinic-onboarding-form";

export const dynamic = "force-dynamic";

const checklistDefinitions = [
  ["clinicActive", "Clinic is active", true, "derived"],
  ["clinicProfile", "Clinic identity and profile", true, "derived"],
  ["clinicOwner", "Active Clinic Owner", true, "derived"],
  ["verifiedDoctor", "Verified same-clinic Doctor", true, "derived"],
  ["timezoneValid", "Valid IANA timezone", true, "derived"],
  ["securityReady", "Security readiness attestation", true, "manual"],
  ["protocolTemplateReady", "Protocol and template readiness", true, "manual"],
  ["brandingPresent", "Clinic branding", false, "derived"],
  ["staffConfigured", "Staff configuration", false, "derived"],
] as const;

export default async function ClinicOnboardingPage() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  const pool = createDatabasePool();
  const onboarding = await readClinicOnboarding(pool, {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  }).finally(() => pool.end());

  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem active href="/clinic/onboarding" label="Onboarding" />
            <ShellNavigationItem href="/clinic/settings" label="Settings" />
            <ShellNavigationItem href="/clinic/settings/branding" label="Branding" />
            <ShellNavigationItem href="/clinic/staff" label="Staff management" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Clinic onboarding</h1>} />}
      >
        <Stack gap="8">
          <Section heading="Current readiness">
            <StatusBadge
              label={onboarding.state.replaceAll("_", " ")}
              variant={onboarding.state === "ready" ? "completed" : "review-required"}
            />
            <p>
              Readiness is calculated from every required blocker. Branding and staff configuration
              are shown for context but are non-blocking.
            </p>
          </Section>
          <Section heading="Checklist">
            <ul>
              {checklistDefinitions.map(([key, label, blocking, source]) => {
                const passed = onboarding.checklist[key];
                return (
                  <li key={key}>
                    <StatusBadge
                      label={`${label}: ${passed ? "passed" : "not passed"}`}
                      variant={passed ? "completed" : blocking ? "review-required" : "neutral"}
                    />{" "}
                    {blocking ? "Blocking" : "Non-blocking"} · {source}
                  </li>
                );
              })}
            </ul>
          </Section>
          <Grid columns={2} gap="6">
            <Section heading="Security readiness">
              <ClinicOnboardingForm
                attestation={onboarding.security}
                attestationCode="SECURITY_READY"
                label="Security readiness"
              />
            </Section>
            <Section heading="Protocol and template readiness">
              <ClinicOnboardingForm
                attestation={onboarding.protocolTemplate}
                attestationCode="PROTOCOL_TEMPLATE_READY"
                label="Protocol and template readiness"
              />
            </Section>
          </Grid>
        </Stack>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
