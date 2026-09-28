import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readPatientPrivacyAcknowledgement } from "@graftvision/database";
import {
  ClinicShell,
  InlineMessage,
  Section,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../../session-activity-boundary";

import { PrivacyAcknowledgementForm } from "./privacy-acknowledgement-form";

export const dynamic = "force-dynamic";

export default async function PatientPrivacyPage({
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
  let view: Awaited<ReturnType<typeof readPatientPrivacyAcknowledgement>> | null = null;
  let denied = false;
  try {
    view = await readPatientPrivacyAcknowledgement(pool, {
      applicationSessionId: session.id,
      patientId: route.patientId,
      providerIdentityId: user.platformUserId,
    });
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }
  if (!denied && !view) notFound();
  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem href="/clinic/patients" label="Patients" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Privacy acknowledgement</h1>} />}
      >
        <p>
          <Link href={`/clinic/patients/${route.patientId}`}>Back to patient profile</Link>
        </p>
        {denied || !view ? (
          <InlineMessage announce title="Privacy acknowledgement unavailable" variant="error">
            The request was denied or could not be completed.
          </InlineMessage>
        ) : (
          <Section heading="Registration privacy notice">
            <PrivacyAcknowledgementForm
              acknowledgementIdempotencyKey={randomUUID()}
              patientId={route.patientId}
              view={view}
              withdrawalIdempotencyKey={randomUUID()}
            />
          </Section>
        )}
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
