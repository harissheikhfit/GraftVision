import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readClinicSettings } from "@graftvision/database";
import {
  ClinicShell,
  KeyValueList,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../session-activity-boundary";

import { ClinicSettingsForm } from "./clinic-settings-form";

export const dynamic = "force-dynamic";

export default async function ClinicSettingsPage() {
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
  const settings = await readClinicSettings(pool, {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  }).finally(() => pool.end());

  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
            <ShellNavigationItem active href="/clinic/settings" label="Settings" />
            <ShellNavigationItem href="/clinic/settings/branding" label="Branding" />
            <ShellNavigationItem href="/clinic/staff" label="Staff management" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Clinic settings</h1>} />}
      >
        <Stack gap="8">
          <Section heading="Profile">
            <ClinicSettingsForm
              clinicCode={settings.clinicCode}
              displayName={settings.displayName}
              revision={settings.revision}
              timezone={settings.timezone}
            />
          </Section>
          <Section heading="Change information">
            <KeyValueList
              items={[
                { id: "revision", label: "Revision", value: String(settings.revision) },
                { id: "updated", label: "Updated", value: settings.updatedAt.toISOString() },
              ]}
            />
          </Section>
        </Stack>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
