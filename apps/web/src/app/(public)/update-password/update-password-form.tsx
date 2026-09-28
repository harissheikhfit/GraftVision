"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthActionState } from "@graftvision/auth";
import { Button, Field, InlineMessage, Stack, TextInput } from "@graftvision/ui";

import { updatePasswordAction } from "./actions";

const defaultInitialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending}
      fullWidth
      isLoading={pending}
      loadingLabel="Updating password"
      type="submit"
    >
      Update password
    </Button>
  );
}

export function UpdatePasswordForm({
  initialState = defaultInitialState,
}: { readonly initialState?: AuthActionState } = {}) {
  const [state, action] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={action} className="gv-auth-form">
      <Stack gap="6">
        {state.message ? (
          <InlineMessage announce title="Error" variant="error">
            {state.message}
          </InlineMessage>
        ) : null}
        <Field label="New password" required>
          {(control) => (
            <TextInput {...control} autoComplete="new-password" name="password" type="password" />
          )}
        </Field>
        <SubmitButton />
      </Stack>
    </form>
  );
}
