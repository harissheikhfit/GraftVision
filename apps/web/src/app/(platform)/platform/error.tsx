"use client";

import { ErrorState } from "@graftvision/ui";

export default function PlatformError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="gv-platform-route-state" id="main-content">
      <ErrorState
        description="The platform summary could not be loaded safely. No operational data was changed."
        heading="Platform administration is unavailable"
        retryAction={
          <button className="gv-button gv-button--primary gv-button--medium" onClick={reset}>
            Try again
          </button>
        }
      />
    </main>
  );
}
