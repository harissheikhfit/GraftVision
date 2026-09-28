"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { readPreliminaryAssessment } from "@graftvision/database";
import { Button, InlineMessage, Section, StatusBadge } from "@graftvision/ui";

import type { PreliminaryAssessmentActionState } from "./preliminary-assessment-actions";

type Assessment = NonNullable<Awaited<ReturnType<typeof readPreliminaryAssessment>>>;

type Action = (
  state: PreliminaryAssessmentActionState,
  formData: FormData,
) => Promise<PreliminaryAssessmentActionState>;

function ActionMessage({ state }: { readonly state: PreliminaryAssessmentActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error" || state.status === "conflict") ref.current?.focus();
  }, [state]);
  return state.message ? (
    <div ref={ref} tabIndex={-1}>
      <InlineMessage
        announce
        title={
          state.status === "success"
            ? "Saved"
            : state.status === "conflict"
              ? "Newer version available"
              : "Unable to save"
        }
        variant={state.status === "success" ? "success" : "error"}
      >
        {state.message}
      </InlineMessage>
    </div>
  ) : null;
}

function IdempotencyInput() {
  const [value] = useState(() => crypto.randomUUID());
  return <input name="idempotencyKey" type="hidden" value={value} />;
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
}: {
  readonly defaultValue?: string | undefined | null;
  readonly label: string;
  readonly name: string;
  readonly options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select defaultValue={defaultValue ?? ""} name={name} required>
        <option value="" disabled>
          Select an option
        </option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PreliminaryAssessmentPanel({
  assessment,
  patientMedicalHistoryVersionId,
  consultationHairLossHistoryVersionId,
  consultationRevision,
  saveAction,
  transitionReviewAction,
}: {
  readonly assessment: Assessment | null;
  readonly patientMedicalHistoryVersionId: string;
  readonly consultationHairLossHistoryVersionId: string;
  readonly consultationRevision: number;
  readonly saveAction: Action;
  readonly transitionReviewAction: Action;
}) {
  const [saveState, submitSave, savePending] = useActionState(saveAction, {});
  const [reviewState, submitReview, reviewPending] = useActionState(transitionReviewAction, {});

  return (
    <>
      <Section heading="Preliminary Assessment">
        <p>Versioned preliminary clinical assessment authored by the verified assigned Doctor.</p>

        {assessment?.downstreamStale ? (
          <InlineMessage announce title="Downstream review required" variant="warning">
            Material clinical history changed. This assessment is now stale and must be recreated or
            reviewed against the new clinical history version.
          </InlineMessage>
        ) : null}

        <form action={submitSave}>
          <fieldset>
            <legend>Preliminary Assessment Details</legend>
            <input name="expectedRevision" type="hidden" value={assessment?.revision ?? 0} />
            <IdempotencyInput />
            <input
              name="patientMedicalHistoryVersionId"
              type="hidden"
              value={patientMedicalHistoryVersionId}
            />
            <input
              name="consultationHairLossHistoryVersionId"
              type="hidden"
              value={consultationHairLossHistoryVersionId}
            />
            <input name="consultationRevision" type="hidden" value={consultationRevision} />

            <SelectField
              defaultValue={assessment?.patternClassification}
              label="Pattern Classification"
              name="patternClassification"
              options={[
                ["hamilton-norwood", "Hamilton–Norwood"],
                ["ludwig", "Ludwig"],
                ["christmas-tree", "Christmas-tree pattern"],
                ["other", "Other"],
              ]}
            />
            <SelectField
              defaultValue={assessment?.certaintyCode}
              label="Certainty"
              name="certaintyCode"
              options={[
                ["clinician-observed", "Clinician observed"],
                ["patient-reported", "Patient reported"],
                ["uncertain", "Uncertain"],
              ]}
            />
            <SelectField
              defaultValue={assessment?.sourceCode}
              label="Source"
              name="sourceCode"
              options={[
                ["observed", "Observed"],
                ["inferred", "Inferred"],
              ]}
            />

            <label>
              <span>Recipient Observation Summary</span>
              <textarea
                defaultValue={assessment?.recipientObservationSummary ?? ""}
                maxLength={1500}
                name="recipientObservationSummary"
              />
            </label>
            <label>
              <span>Donor Observation Summary</span>
              <textarea
                defaultValue={assessment?.donorObservationSummary ?? ""}
                maxLength={1500}
                name="donorObservationSummary"
              />
            </label>
          </fieldset>

          <Button disabled={savePending} type="submit">
            {savePending ? "Saving…" : "Save Preliminary Assessment"}
          </Button>
        </form>
        <ActionMessage state={saveState} />
      </Section>

      {assessment && (
        <Section heading="Review State">
          <p>
            Current State: <StatusBadge label={assessment.reviewState} variant="neutral" />
            (Revision: {assessment.revision})
          </p>
          <form action={submitReview}>
            <input name="expectedRevision" type="hidden" value={assessment.revision} />
            <IdempotencyInput />
            <label>
              <span>Transition State</span>
              <select name="newState" required>
                <option value="doctor_reviewed">Mark Doctor-reviewed</option>
                <option value="superseded">Supersede</option>
                <option value="retracted">Retract</option>
              </select>
            </label>
            <label>
              <span>Controlled Reason (if applicable)</span>
              <input name="controlledReason" type="text" maxLength={200} />
            </label>
            <Button disabled={reviewPending} type="submit" variant="secondary">
              Update Review State
            </Button>
          </form>
          <ActionMessage state={reviewState} />
        </Section>
      )}
    </>
  );
}
