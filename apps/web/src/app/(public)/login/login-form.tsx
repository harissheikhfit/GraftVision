"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthActionState } from "@graftvision/auth";
import { Button, Field, InlineMessage, Stack, TextInput } from "@graftvision/ui";

import { loginAction } from "./actions";

const defaultInitialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending}
      fullWidth
      isLoading={pending}
      loadingLabel="Signing in"
      type="submit"
    >
      Sign in
    </Button>
  );
}

export function LoginForm({
  initialState = defaultInitialState,
}: { readonly initialState?: AuthActionState } = {}) {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="gv-auth-form">
      <Stack gap="6">
        {state.message ? (
          <InlineMessage announce title="Sign-in unavailable" variant="error">
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
        <Field label="Password" required>
          {(control) => (
            <TextInput
              {...control}
              autoComplete="current-password"
              name="password"
              type="password"
            />
          )}
        </Field>
        <SubmitButton />
      </Stack>
    </form>
  );
}
