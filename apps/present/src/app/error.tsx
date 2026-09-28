"use client";

import { Button, ErrorState, PresentationShell } from "@graftvision/ui";

interface RouteErrorProps {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}

export default function RouteError({ reset }: RouteErrorProps) {
  return (
    <PresentationShell>
      <ErrorState
        density="presentation"
        description="No sensitive error details are shown."
        heading="Unable to display this route"
        retryAction={<Button onClick={reset}>Try again</Button>}
      />
    </PresentationShell>
  );
}
