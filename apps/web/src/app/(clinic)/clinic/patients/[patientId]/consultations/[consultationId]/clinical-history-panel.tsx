"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type {
  ClinicalHistorySummary,
  DoctorPrivateNoteProjection,
  HairLossHistoryProjection,
  MedicalHistoryProjection,
} from "@graftvision/database";
import { Button, InlineMessage, Section, StatusBadge } from "@graftvision/ui";

import type { ClinicalActionState } from "./clinical-history-actions";

type Action = (state: ClinicalActionState, formData: FormData) => Promise<ClinicalActionState>;

const reportedOptions = [
  ["none-reported", "None reported"],
  ["reported", "Reported"],
  ["uncertain", "Uncertain"],
  ["not-assessed", "Not assessed"],
] as const;
const sourceOptions = [
  ["patient-reported", "Patient reported"],
  ["caregiver-reported", "Caregiver reported"],
  ["prior-record", "Prior record"],
  ["clinician-observed", "Clinician observed"],
  ["unknown", "Unknown"],
] as const;

function ActionMessage({ state }: { readonly state: ClinicalActionState }) {
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
  readonly defaultValue?: string | undefined;
  readonly label: string;
  readonly name: string;
  readonly options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select defaultValue={defaultValue} name={name} required>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClinicalHistoryPanel({
  createPrivateNoteAction,
  hair,
  medical,
  privateNotes,
  saveHairAction,
  saveMedicalAction,
  summary,
  transitionReviewAction,
}: {
  readonly createPrivateNoteAction: Action;
  readonly hair: HairLossHistoryProjection | null;
  readonly medical: MedicalHistoryProjection | null;
  readonly privateNotes: readonly DoctorPrivateNoteProjection[];
  readonly saveHairAction: Action;
  readonly saveMedicalAction: Action;
  readonly summary: ClinicalHistorySummary | null;
  readonly transitionReviewAction: Action;
}) {
  const [medicalState, submitMedical, medicalPending] = useActionState(saveMedicalAction, {});
  const [hairState, submitHair, hairPending] = useActionState(saveHairAction, {});
  const [reviewState, submitReview, reviewPending] = useActionState(transitionReviewAction, {});
  const [noteState, submitNote, notePending] = useActionState(createPrivateNoteAction, {});

  return (
    <>
      <Section heading="Medical history">
        <p>
          Patient-longitudinal, versioned clinical history. “None reported” is not an absolute
          medical negative.
        </p>
        <form action={submitMedical}>
          <fieldset>
            <legend>Essential safety history</legend>
            <input name="expectedRevision" type="hidden" value={medical?.revision ?? 0} />
            <IdempotencyInput />
            <SelectField
              defaultValue={medical?.medicalConditionStatus}
              label="Medical-condition status"
              name="medicalConditionStatus"
              options={[
                ["no-known-significant-condition", "No known significant condition reported"],
                ["condition-reported", "Condition reported"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <span>Relevant condition clarification</span>
              <textarea
                defaultValue={medical?.medicalConditionClarification}
                maxLength={500}
                name="medicalConditionClarification"
              />
            </label>
            <SelectField
              defaultValue={medical?.allergyStatus}
              label="Allergy status"
              name="allergyStatus"
              options={[
                ["none-reported", "None reported"],
                ["allergy-reported", "Allergy reported"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <span>Allergy substance/category when reported</span>
              <input
                defaultValue={medical?.allergySubstance}
                maxLength={500}
                name="allergySubstance"
              />
            </label>
            <SelectField
              defaultValue={medical?.medicationStatus}
              label="Medication status"
              name="medicationStatus"
              options={[
                ["none-reported", "None reported"],
                ["medication-reported", "Medication reported"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <span>Medication name when reported</span>
              <input defaultValue={medical?.medicationName} maxLength={500} name="medicationName" />
            </label>
            <SelectField
              defaultValue={medical?.previousOperationStatus}
              label="Previous operation"
              name="previousOperationStatus"
              options={reportedOptions.map(([value, label]) => [
                value === "reported" ? "procedure-reported" : value,
                label,
              ])}
            />
            <SelectField
              defaultValue={medical?.anaesthesiaIssueStatus}
              label="Anaesthesia issue"
              name="anaesthesiaIssueStatus"
              options={reportedOptions.map(([value, label]) => [
                value === "reported" ? "issue-reported" : value,
                label,
              ])}
            />
            <SelectField
              defaultValue={medical?.bleedingConcernStatus}
              label="Bleeding concern"
              name="bleedingConcernStatus"
              options={reportedOptions.map(([value, label]) => [
                value === "reported" ? "concern-reported" : value,
                label,
              ])}
            />
            <SelectField
              defaultValue={medical?.healingConcernStatus}
              label="Healing concern"
              name="healingConcernStatus"
              options={reportedOptions.map(([value, label]) => [
                value === "reported" ? "concern-reported" : value,
                label,
              ])}
            />
            <SelectField
              defaultValue={medical?.sourceCode}
              label="Source"
              name="sourceCode"
              options={sourceOptions}
            />
            <SelectField
              defaultValue={medical?.certaintyCode}
              label="Certainty"
              name="certaintyCode"
              options={[
                ["reported", "Reported"],
                ["observed", "Observed"],
                ["verified", "Verified"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <span>Section summary</span>
              <textarea
                defaultValue={medical?.sectionSummary}
                maxLength={1500}
                name="sectionSummary"
              />
            </label>
          </fieldset>
          <Button disabled={medicalPending} type="submit">
            {medicalPending ? "Saving…" : "Save medical-history version"}
          </Button>
        </form>
        <ActionMessage state={medicalState} />
      </Section>

      <Section heading="Hair-loss history">
        <form action={submitHair}>
          <fieldset>
            <legend>Consultation-specific history</legend>
            <input name="expectedRevision" type="hidden" value={hair?.revision ?? 0} />
            <IdempotencyInput />
            <SelectField
              defaultValue={hair?.primaryConcern}
              label="Primary concern"
              name="primaryConcern"
              options={[
                ["frontal-recession", "Frontal recession"],
                ["frontal-thinning", "Frontal thinning"],
                ["mid-scalp-thinning", "Mid-scalp thinning"],
                ["crown-thinning", "Crown thinning"],
                ["diffuse-thinning", "Diffuse thinning"],
                ["previous-transplant-concern", "Previous-transplant concern"],
                ["uncertain", "Uncertain"],
              ]}
            />
            <SelectField
              defaultValue={hair?.onsetKind}
              label="Onset format"
              name="onsetKind"
              options={[
                ["age", "Approximate age"],
                ["year", "Approximate year"],
                ["uncertain", "Uncertain"],
              ]}
            />
            <label>
              <span>Approximate age or year</span>
              <input
                defaultValue={hair?.onsetValue}
                inputMode="numeric"
                max={2100}
                min={0}
                name="onsetValue"
                type="number"
              />
            </label>
            <SelectField
              defaultValue={hair?.progression}
              label="Progression"
              name="progression"
              options={[
                ["stable", "Stable"],
                ["slowly-progressive", "Slowly progressive"],
                ["rapidly-progressive", "Rapidly progressive"],
                ["episodic", "Episodic"],
                ["improved", "Improved"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <SelectField
              defaultValue={hair?.previousHairProcedureStatus}
              label="Previous hair procedure"
              name="previousHairProcedureStatus"
              options={reportedOptions.map(([value, label]) => [
                value === "reported" ? "procedure-reported" : value,
                label,
              ])}
            />
            <SelectField
              defaultValue={hair?.patternClassification}
              label="Pattern classification"
              name="patternClassification"
              options={[
                ["hamilton-norwood", "Hamilton–Norwood"],
                ["ludwig", "Ludwig"],
                ["christmas-tree", "Christmas-tree pattern"],
                ["other-clinician-defined", "Other clinician-defined"],
                ["unclassified", "Unclassified"],
                ["uncertain", "Uncertain"],
              ]}
            />
            <SelectField
              defaultValue={hair?.scalpSymptomStatus}
              label="Scalp symptoms"
              name="scalpSymptomStatus"
              options={[
                ["none-reported", "None reported"],
                ["symptoms-reported", "Symptoms reported"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <input name="scalpSymptomCodes" type="checkbox" value="itching" /> Itching
            </label>
            <label>
              <input name="scalpSymptomCodes" type="checkbox" value="redness" /> Redness
            </label>
            <label>
              <input name="patientGoalCodes" type="checkbox" value="restore-frontal-hairline" />{" "}
              Restore frontal hairline
            </label>
            <label>
              <input name="patientGoalCodes" type="checkbox" value="understand-realistic-options" />{" "}
              Understand realistic options
            </label>
            <SelectField
              defaultValue={hair?.sourceCode}
              label="Source"
              name="sourceCode"
              options={sourceOptions}
            />
            <SelectField
              defaultValue={hair?.certaintyCode}
              label="Certainty"
              name="certaintyCode"
              options={[
                ["reported", "Reported"],
                ["observed", "Observed"],
                ["verified", "Verified"],
                ["uncertain", "Uncertain"],
                ["not-assessed", "Not assessed"],
              ]}
            />
            <label>
              <span>Limited clarification</span>
              <textarea
                defaultValue={hair?.sectionClarification}
                maxLength={1500}
                name="sectionClarification"
              />
            </label>
          </fieldset>
          <Button disabled={hairPending} type="submit">
            {hairPending ? "Saving…" : "Save hair-loss-history version"}
          </Button>
        </form>
        <ActionMessage state={hairState} />
      </Section>

      <Section heading="Required-field readiness">
        <p aria-live="polite">
          Preliminary assessment readiness:{" "}
          <strong>{summary?.preliminaryReady ? "Ready" : "Not ready"}</strong>. Doctor finalisation
          readiness: <strong>{summary?.doctorFinalisationReady ? "Ready" : "Not ready"}</strong>.
        </p>
        {summary?.downstreamStale ? (
          <InlineMessage announce title="Downstream review required" variant="warning">
            Material clinical history changed. Later assessment or planning must use the new
            version.
          </InlineMessage>
        ) : null}
      </Section>

      <Section heading="Review state">
        <p>
          Medical: <StatusBadge label={medical?.reviewState ?? "Not started"} variant="neutral" />{" "}
          Hair loss: <StatusBadge label={hair?.reviewState ?? "Not started"} variant="neutral" />
        </p>
        {(["medical-history", "hair-loss-history"] as const).map((aggregate) => {
          const value = aggregate === "medical-history" ? medical : hair;
          return value ? (
            <form action={submitReview} key={aggregate}>
              <input name="aggregateType" type="hidden" value={aggregate} />
              <input name="expectedRevision" type="hidden" value={value.revision} />
              <IdempotencyInput />
              <input name="reasonCode" type="hidden" value="CLINICAL_SECTION_REVIEW" />
              <label>
                <span>{aggregate === "medical-history" ? "Medical" : "Hair-loss"} action</span>
                <select name="newState">
                  <option value="submitted-for-review">Submit for review</option>
                  <option value="Doctor-reviewed">Mark Doctor-reviewed</option>
                  <option value="amendment-required">Request amendment</option>
                </select>
              </label>
              <Button disabled={reviewPending} type="submit" variant="secondary">
                Update review state
              </Button>
            </form>
          ) : null;
        })}
        <ActionMessage state={reviewState} />
      </Section>

      <Section heading="Doctor-private note">
        <InlineMessage title="Restricted Doctor content" variant="information">
          Only the verified assigned Doctor can create or read this separate projection. Reviewer
          access is disabled.
        </InlineMessage>
        <form action={submitNote}>
          <IdempotencyInput />
          <input name="action" type="hidden" value="create" />
          <input name="expectedRevision" type="hidden" value="0" />
          <label>
            <span>Private note</span>
            <textarea maxLength={3000} name="noteText" required />
          </label>
          <Button disabled={notePending} type="submit">
            {notePending ? "Saving…" : "Create private note"}
          </Button>
        </form>
        {privateNotes.map((note) => (
          <article key={note.noteId}>
            <p>{note.noteText}</p>
            <p>
              Version {note.revision}; saved{" "}
              <time dateTime={new Date(note.updatedAt).toISOString()}>
                {new Date(note.updatedAt).toLocaleString("en-PK")}
              </time>
            </p>
            <form action={submitNote}>
              <IdempotencyInput />
              <input name="action" type="hidden" value="amend" />
              <input name="expectedRevision" type="hidden" value={note.revision} />
              <input name="noteId" type="hidden" value={note.noteId} />
              <label>
                <span>Amended private note</span>
                <textarea defaultValue={note.noteText} maxLength={3000} name="noteText" required />
              </label>
              <Button disabled={notePending} type="submit" variant="secondary">
                Amend note
              </Button>
            </form>
            <form action={submitNote}>
              <IdempotencyInput />
              <input name="action" type="hidden" value="retract" />
              <input name="expectedRevision" type="hidden" value={note.revision} />
              <input name="noteId" type="hidden" value={note.noteId} />
              <input name="reasonCode" type="hidden" value="CLINICAL_NOTE_RETRACTED" />
              <Button disabled={notePending} type="submit" variant="quiet">
                Retract note
              </Button>
            </form>
          </article>
        ))}
        <ActionMessage state={noteState} />
      </Section>

      <Section heading="Saved clinical versions">
        <p>
          Medical revision {medical?.revision ?? 0}; hair-loss revision {hair?.revision ?? 0}.
          Clinical history is saved only after a confirmed versioned operation. Autosave is not
          enabled.
        </p>
      </Section>
    </>
  );
}
