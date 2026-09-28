"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, InlineMessage, Select, Stack, TextInput } from "@graftvision/ui";

import { inviteStaffAction, type StaffActionState } from "./actions";

const initialState: StaffActionState = {};

export interface InviteStaffFormProps {
  readonly canManageHighRiskRoles: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} isLoading={pending} loadingLabel="Inviting" type="submit">
      Invite staff member
    </Button>
  );
}

export function InviteStaffForm({ canManageHighRiskRoles }: InviteStaffFormProps) {
  const [state, action] = useActionState(inviteStaffAction, initialState);
  return (
    <form action={action}>
      <Stack gap="4">
        {state.message ? (
          <InlineMessage announce title="Invitation unavailable" variant="error">
            {state.message}
          </InlineMessage>
        ) : null}
        {state.success ? (
          <InlineMessage announce title="Invitation created" variant="success">
            The invitation is pending for seven days.
          </InlineMessage>
        ) : null}
        <Field label="Email" required>
          {(control) => (
            <TextInput
              {...control}
              autoCapitalize="none"
              autoComplete="email"
              name="email"
              spellCheck={false}
              type="email"
            />
          )}
        </Field>
        <Field label="Clinic role" required>
          {(control) => (
            <Select {...control} name="role">
              <option value="CLINICAL_ASSISTANT">Clinical Assistant</option>
              <option value="PROCEDURE_TECHNICIAN">Procedure Technician</option>
              <option value="RECEPTION">Reception User</option>
              <option value="REPORT_COORDINATOR">Report Coordinator</option>
              <option value="PRESENTATION">Presentation User</option>
              <option value="REVIEWER">Read-Only Clinical Reviewer</option>
              {canManageHighRiskRoles ? (
                <>
                  <option value="CLINIC_ADMIN">Clinic Administrator</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="CLINIC_OWNER">Clinic Owner</option>
                </>
              ) : null}
            </Select>
          )}
        </Field>
        <SubmitButton />
      </Stack>
    </form>
  );
}
