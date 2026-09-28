"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthActionState } from "@graftvision/auth";
import { Button, Field, InlineMessage, Stack, TextInput } from "@graftvision/ui";

import { recoveryAction } from "./actions";

const defaultInitialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending}
      fullWidth
      isLoading={pending}
      loadingLabel="Sending link"
      type="submit"
    >
      Send reset link
    </Button>
  );
}

export function RecoveryForm({
  initialState = defaultInitialState,
}: { readonly initialState?: AuthActionState } = {}) {
  const [state, action] = useActionState(recoveryAction, initialState);

  return (
    <form action={action} className="gv-auth-form">
      <Stack gap="6">
        {state.message ? (
          <InlineMessage announce title="Error" variant="error">
            {state.message}
          </InlineMessage>
        ) : null}
        <Field label="Email" required>
          {(control) => (
            <TextInput
              {...control}
              autoCapitalize="none"
              autoComplete="username"
              inputMode="email"
              name="email"
              spellCheck={false}
              type="email"
            />
          )}
        </Field>
        <SubmitButton />
      </Stack>
    </form>
  );
}
