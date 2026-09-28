"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@graftvision/ui";

export function ManualLockButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function lock() {
    setPending(true);
    try {
      const response = await fetch("/api/session/lock", {
        body: JSON.stringify({ reason: "manual" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (response.ok || response.status === 409) {
        router.replace("/locked");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      disabled={pending}
      onClick={() => void lock()}
      size="small"
      type="button"
      variant="quiet"
    >
      {pending ? "Locking…" : "Lock shared device"}
    </Button>
  );
}
