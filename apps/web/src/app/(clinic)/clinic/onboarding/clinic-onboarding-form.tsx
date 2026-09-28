"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, Inline, InlineMessage, Stack } from "@graftvision/ui";

import { attestClinicOnboardingAction, type ClinicOnboardingActionState } from "./actions";

const initialState: ClinicOnboardingActionState = {};

interface ClinicOnboardingFormProps {
  readonly attestation: {
    readonly expiresAt: Date | null;
    readonly revision: number;
    readonly status: "attested" | "missing" | "withdrawn";
  };
  readonly attestationCode: "PROTOCOL_TEMPLATE_READY" | "SECURITY_READY";
  readonly label: string;
}

function SubmitButton({ label, value }: { readonly label: string; readonly value: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} isLoading={pending} name="status" type="submit" value={value}>
      {label}
    </Button>
  );
}

export function ClinicOnboardingForm({
  attestation,
  attestationCode,
  label,
}: ClinicOnboardingFormProps) {
  const [state, action] = useActionState(attestClinicOnboardingAction, initialState);
  return (
    <form action={action}>
      <Stack gap="4">
        {state.message ? (
          <InlineMessage
            announce
            title={state.status === "conflict" ? "Revision conflict" : label}
            variant={state.status === "success" ? "success" : "error"}
          >
            {state.message}
          </InlineMessage>
        ) : null}
        <p>
          Current status: <strong>{attestation.status}</strong>
        </p>
        <Field label="Optional expiry">
          {(control) => (
            <input
              {...control}
              defaultValue={
                attestation.expiresAt ? attestation.expiresAt.toISOString().slice(0, 16) : undefined
              }
              name="expiresAt"
              type="datetime-local"
            />
          )}
        </Field>
        <input name="attestationCode" type="hidden" value={attestationCode} />
        <input name="revision" type="hidden" value={attestation.revision} />
        <Inline gap="3" wrap>
          <SubmitButton label="Attest ready" value="attested" />
          <SubmitButton label="Withdraw attestation" value="withdrawn" />
        </Inline>
      </Stack>
    </form>
  );
}
