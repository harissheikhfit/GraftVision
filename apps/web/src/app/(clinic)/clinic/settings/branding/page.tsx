import { redirect } from "next/navigation";

import {
  createPrivateClinicBrandingUrl,
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readClinicBranding } from "@graftvision/database";
import {
  ClinicShell,
  KeyValueList,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../session-activity-boundary";

import { ClinicBrandingForm } from "./clinic-branding-form";

export const dynamic = "force-dynamic";

export default async function ClinicBrandingPage() {
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
  const branding = await readClinicBranding(pool, {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  }).finally(() => pool.end());
  const logoUrl = branding.logoObjectKey
    ? await createPrivateClinicBrandingUrl(branding.logoObjectKey)
    : null;

  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
            <ShellNavigationItem href="/clinic/settings" label="Settings" />
            <ShellNavigationItem active href="/clinic/settings/branding" label="Branding" />
            <ShellNavigationItem href="/clinic/staff" label="Staff management" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Clinic branding</h1>} />}
      >
        <Stack gap="8">
          <ClinicBrandingForm
            brandingRevision={branding.brandingRevision}
            clinicName={branding.clinicName}
            linkAccent={branding.linkAccent}
            logoHeight={branding.logoHeight}
            logoUrl={logoUrl}
            logoWidth={branding.logoWidth}
            presentationTitleText={branding.presentationTitleText}
            primaryAccent={branding.primaryAccent}
            reportHeaderText={branding.reportHeaderText}
            secondaryAccent={branding.secondaryAccent}
            selectedControlAccent={branding.selectedControlAccent}
          />
          <Section heading="Change information">
            <KeyValueList
              items={[
                {
                  id: "branding-revision",
                  label: "Branding revision",
                  value: String(branding.brandingRevision),
                },
                {
                  id: "branding-updated",
                  label: "Updated",
                  value: branding.updatedAt.toISOString(),
                },
              ]}
            />
          </Section>
        </Stack>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
