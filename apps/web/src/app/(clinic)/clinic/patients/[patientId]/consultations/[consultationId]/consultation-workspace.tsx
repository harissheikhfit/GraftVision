import type { ConsultationProjection, MaskedPatientProfile } from "@graftvision/database";
import {
  ActiveContextBanner,
  Button,
  Grid,
  InformationPanel,
  InlineMessage,
  KeyValueList,
  Section,
  Stack,
  StatusBadge,
} from "@graftvision/ui";

import {
  ConsultationStatusControls,
  type ConsultationTransitionFormAction,
} from "./consultation-status-controls";

const workflow = [
  "draft",
  "in-progress",
  "capture-complete",
  "review-required",
  "completed",
  "cancelled",
] as const;

const labels = {
  cancelled: "Cancelled",
  "capture-complete": "Capture complete",
  completed: "Completed",
  draft: "Draft",
  "in-progress": "In progress",
  "review-required": "Review required",
} as const;

const futureModules = [
  ["Scanning and media", "Camera capture, uploads, LiDAR, and media are not available."],
  ["3D assessment", "3D reconstruction and anatomical assessment are not available."],
  ["Hairline and graft planning", "Hairline planning and graft estimation are not available."],
  ["Doctor approval", "Clinical review and Doctor approval are not available."],
] as const;

export function ConsultationWorkspace({
  consultation,
  cancelAction,
  patient,
  reloadHref,
  startAction,
  viewerLabel,
}: {
  readonly cancelAction?: ConsultationTransitionFormAction | undefined;
  readonly consultation: ConsultationProjection;
  readonly patient: MaskedPatientProfile;
  readonly reloadHref: string;
  readonly startAction?: ConsultationTransitionFormAction | undefined;
  readonly viewerLabel: string;
}) {
  const currentIndex = workflow.indexOf(consultation.status);
  return (
    <div className="gv-consultation-workspace">
      <div className="gv-consultation-context">
        <ActiveContextBanner
          description={`Consultation status: ${labels[consultation.status]}`}
          label="Masked patient context"
          value={`${patient.patientNumber} · ${patient.maskedName}`}
        />
        <KeyValueList
          items={[
            {
              id: "assigned-doctor",
              label: "Assigned Doctor",
              value: consultation.assignedDoctorPlatformUserId
                ? "Assigned Doctor on record"
                : "No Doctor assigned",
            },
            { id: "current-viewer", label: "Current authorised viewer", value: viewerLabel },
            { id: "revision", label: "Persisted revision", value: consultation.revision },
            {
              id: "last-saved",
              label: "Last saved",
              value: new Date(consultation.updatedAt).toLocaleString("en-PK"),
            },
          ]}
        />
      </div>

      {!consultation.assignedDoctorPlatformUserId ? (
        <InlineMessage title="No Doctor assigned" variant="information">
          The consultation draft exists, but a Doctor has not yet been assigned. Clinical review and
          later gated stages remain unavailable until assignment.
        </InlineMessage>
      ) : null}

      <Section heading="Consultation workflow">
        <ol aria-label="Consultation workflow" className="gv-consultation-workflow">
          {workflow.map((status, index) => {
            const state =
              status === consultation.status
                ? "current"
                : consultation.status !== "cancelled" && index < currentIndex
                  ? "complete"
                  : "unavailable";
            return (
              <li aria-current={state === "current" ? "step" : undefined} key={status}>
                <StatusBadge
                  label={`${labels[status]} — ${
                    state === "current"
                      ? "current"
                      : state === "complete"
                        ? "complete"
                        : "unavailable"
                  }`}
                  variant={
                    state === "current"
                      ? status === "draft"
                        ? "draft"
                        : status === "review-required"
                          ? "review-required"
                          : status === "completed"
                            ? "completed"
                            : status === "cancelled"
                              ? "archived"
                              : "in-progress"
                      : state === "complete"
                        ? "completed"
                        : "neutral"
                  }
                />
              </li>
            );
          })}
        </ol>
        <p>The workflow rail is informational. It does not change consultation status.</p>
      </Section>

      {startAction || cancelAction ? (
        <Section heading="Consultation status">
          <ConsultationStatusControls
            cancelAction={cancelAction}
            reloadHref={reloadHref}
            startAction={startAction}
          />
        </Section>
      ) : null}

      <Section heading="Doctor assignment">
        <InformationPanel
          action={
            <Button disabled type="button" variant="secondary">
              Assign Doctor
            </Button>
          }
          description="Assignment is available only through the controlled Clinic Owner or Clinic Administrator workflow."
          heading="Administrative assignment"
          variant="restricted"
        />
      </Section>

      <Section heading="3D model">
        <InformationPanel
          description="A technical reconstruction model is available only when a current validated model package has been issued. Synthetic, sparse, dense, and surface models are never clinically planning-ready in this workspace."
          heading="Technical model status"
          variant="information"
        />
      </Section>

      <Section heading="Future consultation modules">
        <Grid columns={2} minimumItemWidth="wide">
          {futureModules.map(([heading, description]) => (
            <InformationPanel
              action={
                <Button disabled type="button" variant="quiet">
                  Not available
                </Button>
              }
              description={description}
              heading={heading}
              key={heading}
              status={<span className="gv-consultation-placeholder-status">Future module</span>}
            />
          ))}
        </Grid>
      </Section>

      <Section heading="Save state">
        <Stack gap="2">
          <StatusBadge label="Saved to GraftVision" variant="completed" />
          <p>
            Revision {consultation.revision} was persisted at{" "}
            <time dateTime={consultation.updatedAt.toISOString()}>
              {new Date(consultation.updatedAt).toLocaleString("en-PK")}
            </time>
            . Autosave and offline editing are not available.
          </p>
        </Stack>
      </Section>
    </div>
  );
}
