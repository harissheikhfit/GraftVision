"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, InlineMessage, Stack } from "@graftvision/ui";

import type { CreateConsultationActionState } from "./actions";

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      disabled={pending}
      isLoading={pending}
      loadingLabel="Creating consultation draft"
      type="submit"
    >
      Create consultation draft
    </Button>
  );
}

export function ConsultationCreationForm({
  action,
}: {
  readonly action: (
    state: CreateConsultationActionState,
    formData: FormData,
  ) => Promise<CreateConsultationActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <Stack gap="4">
        {state.message ? (
          <InlineMessage announce title="Consultation creation unavailable" variant="error">
            {state.message}
          </InlineMessage>
        ) : null}
        <p>
          This creates an unassigned draft. Doctor assignment is a separate controlled clinic
          administration action.
        </p>
        <CreateButton />
      </Stack>
    </form>
  );
}
