"use client";

import { useState } from "react";

import { InlineMessage } from "@graftvision/ui";

import { CaptureShell } from "./capture-shell";
import { PairingForm } from "./pairing-form";

export function SessionContent({
  initialScanSessionId,
  token,
}: {
  readonly initialScanSessionId: string | null;
  readonly token: string | null;
}) {
  const [scanSessionId, setScanSessionId] = useState(initialScanSessionId);
  const handlePaired = (sessionId: string) => {
    window.history.replaceState(null, "", `/session?session=${encodeURIComponent(sessionId)}`);
    setScanSessionId(sessionId);
  };
  if (scanSessionId) return <CaptureShell scanSessionId={scanSessionId} />;
  if (!token)
    return (
      <InlineMessage title="Pairing unavailable" variant="error">
        This pairing link is unavailable. Return to the consultation workspace.
      </InlineMessage>
    );
  return <PairingForm onPaired={handlePaired} token={token} />;
}
