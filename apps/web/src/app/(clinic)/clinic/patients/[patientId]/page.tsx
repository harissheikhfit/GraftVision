import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readPatientProfile } from "@graftvision/database";
import {
  ClinicShell,
  EmptyState,
  InlineMessage,
  KeyValueList,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
  StatusBadge,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../session-activity-boundary";

import { PatientLifecycleControls } from "./patient-lifecycle-controls";

export const dynamic = "force-dynamic";

interface PatientProfilePageProps {
  readonly params: Promise<{ readonly patientId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PatientProfilePage({
  params,
  searchParams,
}: PatientProfilePageProps) {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session, route, query] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
    params,
    searchParams,
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  const includeInactive = query.includeInactive === "true";
  const includeArchived = query.includeArchived === "true";
  const pool = createDatabasePool();
  let result: Awaited<ReturnType<typeof readPatientProfile>> | null = null;
  let denied = false;
  try {
    result = await readPatientProfile(pool, {
      applicationSessionId: session.id,
      includeInactive,
      includeArchived,
      patientId: route.patientId,
      providerIdentityId: user.platformUserId,
    });
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }
  if (!denied && !result) notFound();
  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem href="/clinic/patients" label="Patients" />
            <ShellNavigationItem href="/clinic/patients/register" label="Register patient" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Patient profile</h1>} />}
      >
        <p>
          <Link href="/clinic/patients">Back to patient search</Link>
        </p>
        {denied || !result ? (
          <InlineMessage announce title="Patient profile unavailable" variant="error">
            The request was denied or could not be completed.
          </InlineMessage>
        ) : (
          <>
            <Section heading="Identity summary">
              <Stack gap="3">
                <StatusBadge
                  label={
                    result.profile.lifecycleState === "archived"
                      ? "Archived"
                      : result.profile.status === "active"
                        ? "Active"
                        : "Inactive"
                  }
                  variant={
                    result.profile.lifecycleState === "current" &&
                    result.profile.status === "active"
                      ? "neutral"
                      : "archived"
                  }
                />
                {result.profile.lifecycleState === "archived" ? (
                  <InlineMessage title="Archived patient" variant="warning">
                    This record is preserved and view-only. Patient workflows remain unavailable
                    until an authorised restore succeeds.
                  </InlineMessage>
                ) : result.profile.status === "inactive" ? (
                  <InlineMessage title="Inactive patient" variant="warning">
                    This record is view-only. Future clinical actions are unavailable.
                  </InlineMessage>
                ) : null}
                <KeyValueList
                  items={[
                    {
                      id: "patient-number",
                      label: "Patient number",
                      value: result.profile.patientNumber,
                    },
                    { id: "name", label: "Name", value: result.profile.maskedName },
                    {
                      id: "date-of-birth",
                      label: "Date of birth",
                      value: result.profile.maskedDateOfBirth,
                    },
                    { id: "phone", label: "Phone", value: result.profile.maskedPhone },
                    { id: "email", label: "Email", value: result.profile.maskedEmail },
                    {
                      id: "registered",
                      label: "Registered",
                      value: new Date(result.profile.registeredAt).toLocaleDateString("en-PK"),
                    },
                    {
                      id: "updated",
                      label: "Updated",
                      value: new Date(result.profile.updatedAt).toLocaleDateString("en-PK"),
                    },
                  ]}
                />
              </Stack>
            </Section>
            <Section heading="Record timeline">
              {result.timeline.length === 0 ? (
                <EmptyState
                  description="No approved lifecycle events are available."
                  heading="No timeline events"
                />
              ) : (
                <ol aria-label="Curated patient timeline">
                  {result.timeline.map((event) => (
                    <li key={event.referenceId}>
                      <time dateTime={event.occurredAt}>
                        {new Date(event.occurredAt).toLocaleString("en-PK")}
                      </time>{" "}
                      — {event.label}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
            {result.profile.lifecycleState === "current" ? (
              <Section heading="Consultations">
                {result.profile.status === "active" ? (
                  <p>
                    <Link href={`/clinic/patients/${route.patientId}/consultations/new`}>
                      Start a consultation draft
                    </Link>
                  </p>
                ) : (
                  <p>Consultations are unavailable while this patient is inactive.</p>
                )}
              </Section>
            ) : null}
            {result.profile.lifecycleState === "current" ? (
              <Section heading="Privacy acknowledgement">
                <p>
                  <Link href={`/clinic/patients/${route.patientId}/privacy`}>
                    Review privacy acknowledgement
                  </Link>
                </p>
              </Section>
            ) : null}
            <Section heading="Archive and restore">
              <PatientLifecycleControls
                lifecycleRevision={result.profile.lifecycleRevision}
                lifecycleState={result.profile.lifecycleState}
                patientId={route.patientId}
              />
            </Section>
            <Section heading="Future patient modules">
              <p>
                Treatment consent, media, reports, and treatment planning are not available in this
                profile shell.
              </p>
            </Section>
          </>
        )}
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
