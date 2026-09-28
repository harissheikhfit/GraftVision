"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button, InlineMessage } from "@graftvision/ui";

import type { ConsultationCompletionActionState } from "./completion-actions";

type Action = (
  state: ConsultationCompletionActionState,
  formData: FormData,
) => Promise<ConsultationCompletionActionState>;

function ActionMessage({ state }: { readonly state: ConsultationCompletionActionState }) {
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
              : "Unable to complete action"
        }
        variant={state.status === "success" ? "success" : "error"}
      >
        {state.message}
      </InlineMessage>
    </div>
  ) : null;
}

const REOPEN_REASONS = [
  ["PATIENT_INFORMATION_UPDATED", "Patient information updated"],
  ["CLINICAL_HISTORY_UPDATED", "Clinical history updated"],
  ["ASSESSMENT_REVISION_REQUIRED", "Assessment revision required"],
  ["CLERICAL_CORRECTION", "Clerical correction"],
  ["NEW_RELEVANT_INFORMATION", "New relevant information"],
  ["WORKFLOW_RECOVERY", "Workflow recovery"],
] as const;

export function ReopenDialog({
  consultationRevision,
  isOpen,
  onClose,
  reopenAction,
}: {
  readonly consultationRevision: number;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly reopenAction: Action;
}) {
  const [reopenState, submitReopen, reopenPending] = useActionState(reopenAction, {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (!isOpen) return null;

  return (
    <dialog open>
      <article>
        <header>
          <button aria-label="Close" onClick={onClose} />
          <p>
            <strong>Reopen Consultation</strong>
          </p>
        </header>

        <ActionMessage state={reopenState} />

        <form action={submitReopen}>
          <input name="expectedRevision" type="hidden" value={consultationRevision} />
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />

          <label>
            <span>Reason for reopening</span>
            <select name="reopenReasonCode" required>
              <option value="" disabled>
                Select a reason...
              </option>
              {REOPEN_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <footer>
            <Button disabled={reopenPending} type="submit" variant="primary">
              Confirm Reopen
            </Button>
          </footer>
        </form>
      </article>
    </dialog>
  );
}
