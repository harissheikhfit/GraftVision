"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button, InlineMessage, Stack } from "@graftvision/ui";

import type { ConsultationTransitionActionState } from "./actions";

const initialState: ConsultationTransitionActionState = {};
const conflictMessage =
  "This consultation was updated after you opened it. Reload the latest version before trying again.";

export type ConsultationTransitionFormAction = (
  state: ConsultationTransitionActionState,
  formData: FormData,
) => Promise<ConsultationTransitionActionState>;

export function ConsultationStatusControls({
  cancelAction,
  reloadHref,
  startAction,
}: {
  readonly cancelAction?: ConsultationTransitionFormAction | undefined;
  readonly reloadHref: string;
  readonly startAction?: ConsultationTransitionFormAction | undefined;
}) {
  const [startState, submitStart, startPending] = useActionState(
    startAction ?? unavailableAction,
    initialState,
  );
  const [cancelState, submitCancel, cancelPending] = useActionState(
    cancelAction ?? unavailableAction,
    initialState,
  );
  const conflictHeading = useRef<HTMLHeadingElement>(null);
  const hasConflict = startState.status === "conflict" || cancelState.status === "conflict";
  const hasError = startState.status === "error" || cancelState.status === "error";

  useEffect(() => {
    if (hasConflict) conflictHeading.current?.focus();
  }, [hasConflict]);

  return (
    <Stack gap="3">
      {hasConflict ? (
        <div className="gv-consultation-conflict" role="alert">
          <h3 ref={conflictHeading} tabIndex={-1}>
            Consultation changed
          </h3>
          <p>{conflictMessage}</p>
          <a href={reloadHref}>Reload latest version</a>
        </div>
      ) : null}
      {hasError ? (
        <InlineMessage announce title="Consultation not updated" variant="error">
          The request was denied or could not be completed.
        </InlineMessage>
      ) : null}
      <div>
        {startAction ? (
          <form action={submitStart}>
            <Button disabled={startPending || cancelPending} type="submit">
              {startPending ? "Starting…" : "Start preparation"}
            </Button>
          </form>
        ) : null}
        {cancelAction ? (
          <form action={submitCancel}>
            <Button disabled={startPending || cancelPending} type="submit" variant="destructive">
              {cancelPending ? "Cancelling…" : "Cancel consultation"}
            </Button>
          </form>
        ) : null}
      </div>
    </Stack>
  );
}

function unavailableAction(): Promise<ConsultationTransitionActionState> {
  return Promise.resolve({ status: "error" });
}
