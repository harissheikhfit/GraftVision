"use client";

interface GlobalErrorProps {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main className="shell-notice" id="main-content" tabIndex={-1}>
          <p className="shell-notice__label">Development shell</p>
          <h1>Application shell unavailable</h1>
          <p>No sensitive error details are shown.</p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
