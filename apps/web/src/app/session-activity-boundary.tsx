"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Banner, Button, Inline } from "@graftvision/ui";

const warningAfterMs = 25 * 60 * 1000;
const lockAfterMs = 30 * 60 * 1000;
const minimumWriteIntervalMs = 60 * 1000;

export interface SessionActivityBoundaryProps {
  readonly children: ReactNode;
  readonly lastActivityAt: string;
  readonly showManualLock?: boolean;
}

export function isApprovedActivityEvent(
  event: Pick<Event, "isTrusted" | "type">,
  visibilityState: DocumentVisibilityState,
): boolean {
  return (
    event.isTrusted &&
    visibilityState === "visible" &&
    (event.type === "keydown" || event.type === "pointerdown")
  );
}

export function SessionActivityBoundary({
  children,
  lastActivityAt,
  showManualLock = true,
}: SessionActivityBoundaryProps) {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const lastSuccessfulActivity = useRef(new Date(lastActivityAt).getTime());
  const writePending = useRef(false);

  const lock = useCallback(
    async (reason: "idle" | "manual") => {
      const response = await fetch("/api/session/lock", {
        body: JSON.stringify({ reason }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (response.ok || response.status === 409) {
        router.replace("/locked");
        router.refresh();
      }
    },
    [router],
  );

  useEffect(() => {
    const updateState = () => {
      const idleFor = Date.now() - lastSuccessfulActivity.current;
      setWarning(idleFor >= warningAfterMs);
      if (idleFor >= lockAfterMs) {
        void lock("idle");
      }
    };
    updateState();
    const timer = window.setInterval(updateState, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [lock]);

  useEffect(() => {
    const record = async (event: Event) => {
      if (
        !isApprovedActivityEvent(event, document.visibilityState) ||
        writePending.current ||
        Date.now() - lastSuccessfulActivity.current < minimumWriteIntervalMs
      ) {
        return;
      }

      writePending.current = true;
      try {
        const response = await fetch("/api/session/activity", { method: "POST" });
        if (response.ok) {
          lastSuccessfulActivity.current = Date.now();
          setWarning(false);
        } else if (response.status === 401) {
          router.replace("/locked");
          router.refresh();
        }
      } finally {
        writePending.current = false;
      }
    };

    const listener = (event: Event) => {
      void record(event);
    };
    document.addEventListener("keydown", listener);
    document.addEventListener("pointerdown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      document.removeEventListener("pointerdown", listener);
    };
  }, [router]);

  return (
    <>
      {showManualLock ? (
        <div>
          <Button onClick={() => void lock("manual")} size="small" variant="quiet">
            Lock shared device
          </Button>
        </div>
      ) : null}
      {warning ? (
        <Banner
          action={
            <Inline>
              <Button onClick={() => void lock("manual")} size="small" variant="secondary">
                Lock now
              </Button>
            </Inline>
          }
          title="This shared-device session will lock soon"
          variant="warning"
        >
          Use the workspace to remain active, or lock it now before leaving the device.
        </Banner>
      ) : null}
      {children}
    </>
  );
}
