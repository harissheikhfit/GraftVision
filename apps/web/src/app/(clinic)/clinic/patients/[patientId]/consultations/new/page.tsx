import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readPatientProfile } from "@graftvision/database";
import {
  ClinicShell,
  InlineMessage,
  KeyValueList,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../../../session-activity-boundary";

import { createConsultationAction } from "./actions";
import { ConsultationCreationForm } from "./consultation-creation-form";

export const dynamic = "force-dynamic";

export default async function NewConsultationPage({
  params,
}: {
  readonly params: Promise<{ readonly patientId: string }>;
}) {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session, route] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
    params,
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  const pool = createDatabasePool();
  let patient: Awaited<ReturnType<typeof readPatientProfile>> | null = null;
  let denied = false;
  try {
    patient = await readPatientProfile(pool, {
      applicationSessionId: session.id,
      patientId: route.patientId,
      providerIdentityId: user.platformUserId,
    });
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }
  const action = createConsultationAction.bind(null, {
    idempotencyKey: randomUUID(),
    patientId: route.patientId,
  });

  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem active href="/clinic/patients" label="Patients" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>New consultation</h1>} />}
      >
        <p>
          <Link href={`/clinic/patients/${route.patientId}`}>Back to patient profile</Link>
        </p>
        {denied || !patient ? (
          <InlineMessage announce title="Consultation unavailable" variant="error">
            The request was denied or the patient is not eligible for a consultation.
          </InlineMessage>
        ) : (
          <>
            <Section heading="Masked patient context">
              <KeyValueList
                items={[
                  {
                    id: "patient-number",
                    label: "Patient number",
                    value: patient.profile.patientNumber,
                  },
                  { id: "patient-name", label: "Patient", value: patient.profile.maskedName },
                  { id: "patient-status", label: "Status", value: patient.profile.status },
                ]}
              />
            </Section>
            <Section heading="Create draft">
              <ConsultationCreationForm action={action} />
            </Section>
          </>
        )}
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
