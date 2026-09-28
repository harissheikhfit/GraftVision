"use client";

import { useEffect, useRef, useState } from "react";

import { Button, InlineMessage } from "@graftvision/ui";

export function PairingForm({
  onPaired,
  token,
}: {
  readonly onPaired: (scanSessionId: string) => void;
  readonly token: string;
}) {
  const [status, setStatus] = useState<"denied" | "idle" | "paired">("idle");
  const [pending, setPending] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== "idle") statusRef.current?.focus();
  }, [status]);
  if (status === "paired") {
    return (
      <div aria-live="polite" ref={statusRef} tabIndex={-1}>
        <InlineMessage announce title="Device paired" variant="success">
          This device is connected to the scan session. Capture has not started.
        </InlineMessage>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void fetch("http://localhost:3000/api/scan/pair", {
          body: JSON.stringify({ token }),
          credentials: "include",
          headers: { "content-type": "application/json" },
          method: "POST",
        })
          .then(async (response) => {
            const result = (await response.json().catch(() => null)) as {
              readonly scanSessionId?: string;
            } | null;
            if (response.ok && result?.scanSessionId) {
              onPaired(result.scanSessionId);
              setStatus("paired");
              return;
            }
            setStatus("denied");
          })
          .catch(() => {
            setStatus("denied");
          })
          .finally(() => {
            setPending(false);
          });
      }}
    >
      <p>Confirm pairing on this authorised clinic device.</p>
      <Button disabled={pending} type="submit" variant="primary">
        {pending ? "Pairing device…" : "Pair this device"}
      </Button>
      {status === "denied" ? (
        <div aria-live="polite" ref={statusRef} tabIndex={-1}>
          <InlineMessage announce title="Pairing unavailable" variant="error">
            This pairing code is unavailable. Return to the consultation workspace for a new code.
          </InlineMessage>
        </div>
      ) : null}
    </form>
  );
}
