"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type {
  readConsultation,
  getConsultationAnalyzerReadiness,
  readLifecycleEvents,
} from "@graftvision/database";
import { Button, InlineMessage, Section, StatusBadge } from "@graftvision/ui";

import { ReopenDialog } from "./reopen-dialog";

import type { ConsultationCompletionActionState } from "./completion-actions";

type Consultation = NonNullable<Awaited<ReturnType<typeof readConsultation>>>;
type Readiness = Awaited<ReturnType<typeof getConsultationAnalyzerReadiness>>;
type Events = Awaited<ReturnType<typeof readLifecycleEvents>>;

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

export function CompletionPanel({
  consultation,
  analyzerReadiness,
  events,
  completeAction,
  reopenAction,
}: {
  readonly consultation: Consultation;
  readonly analyzerReadiness: Readiness;
  readonly events: Events;
  readonly completeAction: Action;
  readonly reopenAction: Action;
}) {
  const [completeState, submitComplete, completePending] = useActionState(completeAction, {});
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <Section heading="Consultation Completion">
      <p>Manage the completion state and analyzer readiness of the consultation.</p>

      {analyzerReadiness?.isReady ? (
        <InlineMessage announce title="Analyzer Ready" variant="success">
          All required clinical evidence is complete and reviewed.
        </InlineMessage>
      ) : consultation.status === "completed" ? (
        <InlineMessage announce title="Analyzer Not Ready" variant="warning">
          Consultation is completed but clinical evidence has changed and is no longer ready.
        </InlineMessage>
      ) : null}

      <ActionMessage state={completeState} />

      <dl>
        <dt>Status</dt>
        <dd>
          <StatusBadge label={consultation.status} variant="neutral" />
        </dd>
        {analyzerReadiness?.lastCompletedAt && (
          <>
            <dt>Last Completed</dt>
            <dd>{new Date(analyzerReadiness.lastCompletedAt).toLocaleString()}</dd>
          </>
        )}
      </dl>

      {events.length > 0 && (
        <details>
          <summary>Lifecycle Events ({events.length})</summary>
          <ul>
            {events.map((event) => (
              <li key={`${event.consultationRevision}-${event.eventType}`}>
                <strong>{event.eventType}</strong> at {new Date(event.occurredAt).toLocaleString()}{" "}
                (Rev: {event.consultationRevision})
              </li>
            ))}
          </ul>
        </details>
      )}

      {consultation.status !== "completed" && consultation.status !== "cancelled" ? (
        <form action={submitComplete}>
          <input name="expectedRevision" type="hidden" value={consultation.revision} />
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
          <Button disabled={completePending} type="submit" variant="primary">
            Complete Consultation
          </Button>
        </form>
      ) : null}

      {consultation.status === "completed" ? (
        <>
          <Button
            onClick={() => {
              setIsReopenDialogOpen(true);
            }}
            variant="secondary"
          >
            Reopen Consultation
          </Button>
          <ReopenDialog
            consultationRevision={consultation.revision}
            isOpen={isReopenDialogOpen}
            onClose={() => {
              setIsReopenDialogOpen(false);
            }}
            reopenAction={reopenAction}
          />
        </>
      ) : null}
    </Section>
  );
}
