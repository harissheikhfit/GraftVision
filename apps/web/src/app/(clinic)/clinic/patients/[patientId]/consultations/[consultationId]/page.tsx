import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  readClinicalHistorySummary,
  readConsultation,
  readHairLossHistory,
  readMedicalHistory,
  readActiveDoctorPrivateNotes,
  readPatientProfile,
  readPreliminaryAssessment,
  getConsultationAnalyzerReadiness,
  readLifecycleEvents,
} from "@graftvision/database";
import {
  ClinicShell,
  InlineMessage,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../../../../session-activity-boundary";

import { transitionConsultationStatusAction } from "./actions";
import {
  createPrivateNoteAction,
  saveHairLossHistoryAction,
  saveMedicalHistoryAction,
  transitionClinicalReviewAction,
} from "./clinical-history-actions";
import { ClinicalHistoryPanel } from "./clinical-history-panel";
import { completeConsultationAction, reopenConsultationAction } from "./completion-actions";
import { CompletionPanel } from "./completion-panel";
import { ConsultationWorkspace } from "./consultation-workspace";
import {
  savePreliminaryAssessmentAction,
  transitionPreliminaryAssessmentReviewAction,
} from "./preliminary-assessment-actions";
import { PreliminaryAssessmentPanel } from "./preliminary-assessment-panel";
import { ScanPairingPanel } from "./scan-pairing-panel";
import {
  createScanAnalyzerHandoffAction,
  overrideScanQualityResultAction,
  requestScanQualityRetakeAction,
} from "./scan-quality-actions";

export const dynamic = "force-dynamic";

export default async function ConsultationWorkspacePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{
    readonly consultationId: string;
    readonly patientId: string;
  }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const pool = createDatabasePool();
  let consultation: Awaited<ReturnType<typeof readConsultation>> = null;
  let patient: Awaited<ReturnType<typeof readPatientProfile>> = null;
  let medical: Awaited<ReturnType<typeof readMedicalHistory>> = null;
  let hair: Awaited<ReturnType<typeof readHairLossHistory>> = null;
  let clinicalSummary: Awaited<ReturnType<typeof readClinicalHistorySummary>> = null;
  let preliminaryAssessment: Awaited<ReturnType<typeof readPreliminaryAssessment>> = null;
  let privateNotes: Awaited<ReturnType<typeof readActiveDoctorPrivateNotes>> = [];
  let analyzerReadiness: Awaited<ReturnType<typeof getConsultationAnalyzerReadiness>> = null;
  let lifecycleEvents: Awaited<ReturnType<typeof readLifecycleEvents>> = [];
  let denied = false;
  try {
    [
      consultation,
      patient,
      medical,
      hair,
      clinicalSummary,
      preliminaryAssessment,
      analyzerReadiness,
      lifecycleEvents,
    ] = await Promise.all([
      readConsultation(pool, {
        applicationSessionId: session.id,
        consultationId: route.consultationId,
        providerIdentityId: user.platformUserId,
      }),
      readPatientProfile(pool, {
        applicationSessionId: session.id,
        patientId: route.patientId,
        providerIdentityId: user.platformUserId,
      }),
      readMedicalHistory(pool, {
        applicationSessionId: session.id,
        consultationId: route.consultationId,
        providerIdentityId: user.platformUserId,
      }),
      readHairLossHistory(pool, {
        applicationSessionId: session.id,
        consultationId: route.consultationId,
        providerIdentityId: user.platformUserId,
      }),
      readClinicalHistorySummary(pool, {
        applicationSessionId: session.id,
        consultationId: route.consultationId,
        providerIdentityId: user.platformUserId,
      }),
      readPreliminaryAssessment(pool, session.id, user.platformUserId, route.consultationId),
      getConsultationAnalyzerReadiness(pool, session.clinicId, route.consultationId),
      readLifecycleEvents(
        pool,
        session.id,
        user.platformUserId,
        session.clinicId,
        route.consultationId,
      ),
    ]);
    if (consultation?.patientId !== route.patientId) denied = true;
    if (!denied) {
      privateNotes = await readActiveDoctorPrivateNotes(pool, {
        applicationSessionId: session.id,
        consultationId: route.consultationId,
        providerIdentityId: user.platformUserId,
      }).catch(() => []);
    }
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }

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
        toolbar={<ShellToolbar title={<h1>Consultation workspace</h1>} />}
      >
        <p>
          <Link href={`/clinic/patients/${route.patientId}`}>Back to patient profile</Link>
        </p>
        {query.created === "true" && !denied ? (
          <InlineMessage announce title="Consultation draft created" variant="success">
            The persisted draft is ready. No Doctor was assigned automatically.
          </InlineMessage>
        ) : null}
        {query.updated === "true" && !denied ? (
          <InlineMessage announce title="Consultation updated" variant="success">
            The latest consultation revision is displayed.
          </InlineMessage>
        ) : null}
        {denied || !consultation || !patient ? (
          <InlineMessage announce title="Consultation unavailable" variant="error">
            The consultation was not found or the request was denied.
          </InlineMessage>
        ) : (
          <>
            <ConsultationWorkspace
              cancelAction={
                consultation.status === "draft" || consultation.status === "in-progress"
                  ? transitionConsultationStatusAction.bind(null, {
                      consultationId: consultation.id,
                      expectedRevision: consultation.revision,
                      idempotencyKey: randomUUID(),
                      newStatus: "cancelled",
                      patientId: route.patientId,
                      reasonCode: "CONSULTATION_CANCELLED",
                    })
                  : undefined
              }
              consultation={consultation}
              patient={patient.profile}
              reloadHref={`/clinic/patients/${route.patientId}/consultations/${consultation.id}`}
              startAction={
                consultation.status === "draft"
                  ? transitionConsultationStatusAction.bind(null, {
                      consultationId: consultation.id,
                      expectedRevision: consultation.revision,
                      idempotencyKey: randomUUID(),
                      newStatus: "in-progress",
                      patientId: route.patientId,
                      reasonCode: "PREPARATION_STARTED",
                    })
                  : undefined
              }
              viewerLabel={user.displayLabel}
            />
            <ClinicalHistoryPanel
              createPrivateNoteAction={createPrivateNoteAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              hair={hair}
              medical={medical}
              privateNotes={privateNotes}
              saveHairAction={saveHairLossHistoryAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              saveMedicalAction={saveMedicalHistoryAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              summary={clinicalSummary}
              transitionReviewAction={transitionClinicalReviewAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
            />
            {medical && hair && (
              <PreliminaryAssessmentPanel
                assessment={preliminaryAssessment}
                patientMedicalHistoryVersionId={medical.versionId}
                consultationHairLossHistoryVersionId={hair.versionId}
                consultationRevision={consultation.revision}
                saveAction={savePreliminaryAssessmentAction.bind(null, {
                  consultationId: consultation.id,
                  patientId: route.patientId,
                })}
                transitionReviewAction={transitionPreliminaryAssessmentReviewAction.bind(null, {
                  consultationId: consultation.id,
                  patientId: route.patientId,
                })}
              />
            )}
            <CompletionPanel
              consultation={consultation}
              analyzerReadiness={analyzerReadiness}
              events={lifecycleEvents}
              completeAction={completeConsultationAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              reopenAction={reopenConsultationAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
            />
            <ScanPairingPanel
              consultationId={consultation.id}
              patientId={route.patientId}
              ready={Boolean(analyzerReadiness?.isReady)}
              createHandoffAction={createScanAnalyzerHandoffAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              overrideQualityAction={overrideScanQualityResultAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
              requestRetakeAction={requestScanQualityRetakeAction.bind(null, {
                consultationId: consultation.id,
                patientId: route.patientId,
              })}
            />
          </>
        )}
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
