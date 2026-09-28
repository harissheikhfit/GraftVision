"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, InlineMessage, Select, Stack, TextInput } from "@graftvision/ui";

import { updateClinicSettingsAction, type ClinicSettingsActionState } from "./actions";

const initialState: ClinicSettingsActionState = {};

export interface ClinicSettingsFormProps {
  readonly clinicCode: string;
  readonly displayName: string;
  readonly revision: number;
  readonly timezone: string;
}

const timezones = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} isLoading={pending} loadingLabel="Saving" type="submit">
      Save settings
    </Button>
  );
}

export function ClinicSettingsForm({
  clinicCode,
  displayName,
  revision,
  timezone,
}: ClinicSettingsFormProps) {
  const [state, action] = useActionState(updateClinicSettingsAction, initialState);
  const availableTimezones = timezones.includes(timezone as (typeof timezones)[number])
    ? timezones
    : [timezone, ...timezones];
  return (
    <form action={action}>
      <Stack gap="4">
        {state.message ? (
          <InlineMessage
            announce
            title={state.status === "conflict" ? "Revision conflict" : "Clinic settings"}
            variant={state.status === "success" ? "success" : "error"}
          >
            {state.message}
          </InlineMessage>
        ) : null}
        <Field label="Clinic code" readOnly>
          {(control) => <TextInput {...control} name="clinicCode" value={clinicCode} />}
        </Field>
        <Field
          error={state.fieldErrors?.displayName}
          errorLive="assertive"
          label="Clinic display name"
          required
        >
          {(control) => (
            <TextInput {...control} defaultValue={displayName} maxLength={160} name="displayName" />
          )}
        </Field>
        <Field error={state.fieldErrors?.timezone} errorLive="assertive" label="Timezone" required>
          {(control) => (
            <Select {...control} defaultValue={timezone} name="timezone">
              {availableTimezones.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <input name="revision" type="hidden" value={revision} />
        <SubmitButton />
      </Stack>
    </form>
  );
}
