"use client";

import { useActionState, useState } from "react";

import { Button, Field, InlineMessage, Select, Stack } from "@graftvision/ui";

import {
  archivePatientAction,
  restorePatientAction,
  type PatientLifecycleActionState,
} from "./lifecycle-actions";

const initialState: PatientLifecycleActionState = {};

export function PatientLifecycleControls({
  lifecycleRevision,
  lifecycleState,
  patientId,
}: {
  readonly lifecycleRevision: number;
  readonly lifecycleState: "current" | "archived";
  readonly patientId: string;
}) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    archivePatientAction,
    initialState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restorePatientAction,
    initialState,
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const state = lifecycleState === "current" ? archiveState : restoreState;
  return (
    <form action={lifecycleState === "current" ? archiveAction : restoreAction}>
      <Stack gap="3">
        <input name="patientId" type="hidden" value={patientId} />
        <input name="expectedRevision" type="hidden" value={lifecycleRevision} />
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <Field label={lifecycleState === "current" ? "Archive reason" : "Restore reason"}>
          {(control) => (
            <Select {...control} name="reasonCode" required>
              <option value="">Select a controlled reason</option>
              {lifecycleState === "current" ? (
                <>
                  <option value="duplicate_created_in_error">Duplicate created in error</option>
                  <option value="patient_requested_inactive_record">
                    Patient requested inactive record
                  </option>
                  <option value="registered_in_error">Registered in error</option>
                  <option value="no_longer_receiving_services">No longer receiving services</option>
                  <option value="administrative_cleanup">Administrative cleanup</option>
                  <option value="other_controlled">Other controlled reason</option>
                </>
              ) : (
                <>
                  <option value="patient_returned">Patient returned</option>
                  <option value="archived_in_error">Archived in error</option>
                  <option value="record_review_completed">Record review completed</option>
                  <option value="administrative_restore">Administrative restore</option>
                </>
              )}
            </Select>
          )}
        </Field>
        <label>
          <input name="confirmed" required type="checkbox" value="yes" /> I confirm this reversible
          lifecycle change.
        </label>
        <Button disabled={archivePending || restorePending} type="submit">
          {lifecycleState === "current" ? "Archive patient" : "Restore patient"}
        </Button>
        {state.status ? (
          <InlineMessage
            announce
            title={state.status === "success" ? "Lifecycle updated" : "Update unavailable"}
            variant={state.status === "success" ? "success" : "error"}
          >
            {state.message}
          </InlineMessage>
        ) : null}
      </Stack>
    </form>
  );
}
