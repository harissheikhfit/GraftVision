import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  ClinicShell,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../session-activity-boundary";

import { PatientRegistrationForm } from "./patient-registration-form";

export const dynamic = "force-dynamic";

export default async function PatientRegistrationPage() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem active href="/clinic/patients/register" label="Register patient" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Register patient</h1>} />}
      >
        <Section heading="Patient registration">
          <p>
            Search-safe duplicate checks are limited to this clinic. Possible matches are masked and
            never merged automatically.
          </p>
          <PatientRegistrationForm idempotencyKey={randomUUID()} />
        </Section>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
