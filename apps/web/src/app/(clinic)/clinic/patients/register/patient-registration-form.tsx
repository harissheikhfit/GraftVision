"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  Button,
  Checkbox,
  DateField,
  Field,
  InlineMessage,
  Select,
  Stack,
  TextInput,
} from "@graftvision/ui";

import { registerPatientAction, type PatientRegistrationActionState } from "./actions";

function SubmitButton({ overriding }: { readonly overriding: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      disabled={pending}
      isLoading={pending}
      loadingLabel={overriding ? "Confirming registration" : "Checking registration"}
      type="submit"
    >
      {overriding ? "Confirm distinct patient" : "Check and register"}
    </Button>
  );
}

export function PatientRegistrationForm({ idempotencyKey }: { readonly idempotencyKey: string }) {
  const [state, action] = useActionState<PatientRegistrationActionState, FormData>(
    registerPatientAction,
    { idempotencyKey },
  );
  const duplicateWarning = state.status === "duplicate_warning";
  return (
    <form action={action}>
      <Stack gap="4">
        {state.message ? (
          <InlineMessage
            announce
            title={
              duplicateWarning
                ? "Possible duplicate"
                : state.status === "success"
                  ? "Registration complete"
                  : "Patient registration"
            }
            variant={
              state.status === "success" ? "success" : duplicateWarning ? "warning" : "error"
            }
          >
            {state.message}
            {state.patientNumber ? ` Reference: ${state.patientNumber}` : null}
          </InlineMessage>
        ) : null}
        <Field error={state.fieldErrors?.fullName} errorLive="assertive" label="Full name" required>
          {(control) => (
            <TextInput
              {...control}
              defaultValue={state.values?.fullName}
              maxLength={160}
              name="fullName"
            />
          )}
        </Field>
        <DateField
          defaultValue={state.values?.dateOfBirth}
          error={state.fieldErrors?.dateOfBirth}
          label="Date of birth"
          name="dateOfBirth"
          required
        />
        <Field
          description="Use E.164 international format, for example +923001234567."
          error={state.fieldErrors?.phone}
          errorLive="assertive"
          label="Phone"
          required
        >
          {(control) => (
            <TextInput
              {...control}
              autoComplete="tel"
              defaultValue={state.values?.phone}
              inputMode="tel"
              maxLength={24}
              name="phone"
            />
          )}
        </Field>
        <Field error={state.fieldErrors?.email} errorLive="assertive" label="Email" optional>
          {(control) => (
            <TextInput
              {...control}
              autoComplete="email"
              defaultValue={state.values?.email}
              maxLength={254}
              name="email"
              type="email"
            />
          )}
        </Field>
        <input name="idempotencyKey" type="hidden" value={state.idempotencyKey ?? idempotencyKey} />
        {duplicateWarning ? (
          <section aria-labelledby="duplicate-results-heading">
            <Stack gap="3">
              <h2 id="duplicate-results-heading">Masked same-clinic matches</h2>
              <ul>
                {state.duplicates?.map((duplicate) => (
                  <li key={duplicate.patientReference}>
                    {duplicate.maskedPatientNumber} · {duplicate.maskedName} · born{" "}
                    {duplicate.birthYear} · phone on file
                    {duplicate.hasEmail ? " · email on file" : ""} ·{" "}
                    {duplicate.matchReasonCodes.join(", ")}
                  </li>
                ))}
              </ul>
              <Field label="Override reason" required>
                {(control) => (
                  <Select {...control} name="overrideReasonCode" placeholder="Select a reason">
                    <option value="CONFIRMED_DISTINCT_PERSON">Confirmed distinct person</option>
                    <option value="KNOWN_SEPARATE_RECORD">Known separate record</option>
                  </Select>
                )}
              </Field>
              <Checkbox
                label="I confirm this is a distinct patient record."
                name="confirmOverride"
                required
                value="yes"
              />
            </Stack>
          </section>
        ) : null}
        <SubmitButton overriding={duplicateWarning} />
      </Stack>
    </form>
  );
}
