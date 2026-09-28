"use client";

import { useEffect, useRef, useState } from "react";

import type { ScanTechnicalImageMetrics } from "@graftvision/types";
import { Button, InlineMessage } from "@graftvision/ui";

const scanOrigin = "http://localhost:3000";
type Step =
  | "preparation"
  | "front"
  | "left_profile"
  | "right_profile"
  | "crown"
  | "donor_rear"
  | "donor_left"
  | "donor_right"
  | "review"
  | "capture_complete";
type RemoteState = {
  readonly capture: {
    readonly captureStatus: "preparation" | "capturing" | "review" | "capture_complete";
    readonly completedSteps: readonly string[];
    readonly currentStep: Step;
    readonly lastActivityAt: string;
    readonly revision: number;
  };
  readonly status: "paired" | "completed";
  readonly quality: readonly {
    readonly assetId: string | null;
    readonly captureStep: string;
    readonly qualityRevision: number | null;
    readonly qualityState: "passed" | "retake_required" | "warning" | "invalidated" | null;
    readonly reasonCode: string | null;
    readonly stale: boolean;
  }[];
  readonly readiness: {
    readonly blockerCodes: readonly string[];
    readonly isReady: boolean;
    readonly qualityReviewRevision: number;
  };
};

const labels: Record<Step, string> = {
  capture_complete: "Capture complete",
  crown: "Crown",
  donor_left: "Donor left",
  donor_rear: "Donor rear",
  donor_right: "Donor right",
  front: "Front",
  left_profile: "Left profile",
  preparation: "Preparation",
  review: "Review",
  right_profile: "Right profile",
};

export function CaptureShell({ scanSessionId }: { readonly scanSessionId: string }) {
  const [camera, setCamera] = useState<"denied" | "idle" | "ready">("idle");
  const [error, setError] = useState<"denied" | "disconnected" | "unavailable" | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<RemoteState | null>(null);
  const [technicalMetrics, setTechnicalMetrics] = useState<ScanTechnicalImageMetrics | null>(null);
  const [uploadState, setUploadState] = useState<"failed" | "idle" | "queued" | "uploaded">("idle");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const uploadAttempt = useRef<{
    readonly assetId: string;
    readonly idempotencyKey: string;
  } | null>(null);

  const readState = async () => {
    try {
      const response = await fetch(`${scanOrigin}/api/scan-sessions/${scanSessionId}/status`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        setError("denied");
        return;
      }
      const next = (await response.json()) as RemoteState;
      setState(next);
      setError(null);
    } catch {
      setError("disconnected");
    }
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void readState();
    }, 0);
    const timer = window.setInterval(() => {
      void readState();
    }, 2_500);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      stream.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
    // readState intentionally remains local so only a scan-session change re-subscribes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanSessionId]);

  const requestCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("denied");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      if (video.current) video.current.srcObject = stream.current;
      setCamera("ready");
    } catch {
      setCamera("denied");
    }
  };

  const localCapture = () => {
    const source = video.current;
    if (!source || !source.videoWidth || !source.videoHeight) {
      setError("unavailable");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) {
      setError("unavailable");
      return;
    }
    let brightnessTotal = 0;
    let laplacianTotal = 0;
    let laplacianSquares = 0;
    let samples = 0;
    const stride = Math.max(4, Math.floor(Math.min(canvas.width, canvas.height) / 128));
    const luminance = (x: number, y: number) => {
      const index = (y * canvas.width + x) * 4;
      return (
        (pixels[index] ?? 0) * 0.2126 +
        (pixels[index + 1] ?? 0) * 0.7152 +
        (pixels[index + 2] ?? 0) * 0.0722
      );
    };
    for (let y = stride; y < canvas.height - stride; y += stride) {
      for (let x = stride; x < canvas.width - stride; x += stride) {
        const value = luminance(x, y);
        brightnessTotal += value;
        const laplacian =
          4 * value -
          luminance(x - stride, y) -
          luminance(x + stride, y) -
          luminance(x, y - stride) -
          luminance(x, y + stride);
        laplacianTotal += laplacian;
        laplacianSquares += laplacian * laplacian;
        samples += 1;
      }
    }
    const averageLaplacian = laplacianTotal / Math.max(samples, 1);
    const metrics: ScanTechnicalImageMetrics = {
      blurVariance: laplacianSquares / Math.max(samples, 1) - averageLaplacian * averageLaplacian,
      brightness: brightnessTotal / Math.max(samples, 1),
      // This deliberately remains a bounded technical framing signal; it is not a clinical measure.
      framingCoverage: 0.5,
      height: canvas.height,
      orientation: 1,
      width: canvas.width,
    };
    setTechnicalMetrics(metrics);
    setPreview(canvas.toDataURL("image/jpeg", 0.8));
    setUploadState("queued");
    uploadAttempt.current = { assetId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
  };

  const uploadCurrentPreview = async (): Promise<boolean> => {
    if (
      !preview ||
      !technicalMetrics ||
      !state ||
      state.capture.currentStep === "preparation" ||
      state.capture.currentStep === "review"
    )
      return false;
    setPending(true);
    try {
      const blob = await (await fetch(preview)).blob();
      const form = new FormData();
      const attempt = uploadAttempt.current;
      if (!attempt) return false;
      form.set("assetId", attempt.assetId);
      form.set("captureRevision", String(state.capture.revision));
      form.set("file", new File([blob], "capture.jpeg", { type: "image/jpeg" }));
      form.set("idempotencyKey", attempt.idempotencyKey);
      form.set("step", state.capture.currentStep);
      form.set("technicalMetrics", JSON.stringify(technicalMetrics));
      const result = await fetch(`${scanOrigin}/api/scan-sessions/${scanSessionId}/media`, {
        body: form,
        credentials: "include",
        method: "POST",
      });
      if (!result.ok) throw new Error("upload denied");
      setUploadState("uploaded");
      await readState();
      return true;
    } catch {
      setUploadState("failed");
      return false;
    } finally {
      setPending(false);
    }
  };

  const send = async (
    action: "complete" | "retake" | "review",
    step: Step | undefined = state?.capture.currentStep,
  ) => {
    if (!state || !step || step === "capture_complete") return;
    setPending(true);
    try {
      const response = await fetch(`${scanOrigin}/api/scan-sessions/${scanSessionId}/capture`, {
        body: JSON.stringify({ action, expectedRevision: state.capture.revision, step }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setError("denied");
        return;
      }
      setPreview(null);
      setTechnicalMetrics(null);
      setUploadState("idle");
      uploadAttempt.current = null;
      await readState();
    } catch {
      setError("disconnected");
    } finally {
      setPending(false);
    }
  };

  if (error === "denied")
    return (
      <InlineMessage announce title="Capture unavailable" variant="error">
        This capture session is no longer available.
      </InlineMessage>
    );
  if (!state)
    return (
      <InlineMessage announce title="Connecting" variant="information">
        Checking the paired capture session.
      </InlineMessage>
    );
  if (state.status === "completed" || state.capture.captureStatus === "capture_complete")
    return (
      <InlineMessage
        announce
        title={state.readiness.isReady ? "Scan ready" : "Capture awaiting validation"}
        variant={state.readiness.isReady ? "success" : "information"}
      >
        {state.readiness.isReady
          ? "All required angles have passed trusted technical validation."
          : "Capture is recorded. Complete any required technical retakes before review."}
      </InlineMessage>
    );

  const isReview = state.capture.currentStep === "review";
  const isPreparation = state.capture.currentStep === "preparation";
  const completed = state.capture.completedSteps.length;
  const currentQuality = state.quality.find(
    (quality) => quality.captureStep === state.capture.currentStep,
  );
  return (
    <div aria-live="polite" className="gv-scan-capture">
      <p>
        Step {Math.min(completed + 1, 8)} of 8 · {labels[state.capture.currentStep]}
      </p>
      <progress aria-label="Capture progress" max={8} value={completed} />
      {camera === "idle" ? (
        <Button
          onClick={() => {
            void requestCamera();
          }}
          type="button"
          variant="primary"
        >
          Allow camera
        </Button>
      ) : null}
      {camera === "denied" ? (
        <InlineMessage announce title="Camera unavailable" variant="error">
          Camera access is required for guided capture. Check device permissions and try again.
        </InlineMessage>
      ) : null}
      {camera === "ready" && !isReview && !isPreparation ? (
        <>
          <video
            aria-label="Camera preview"
            autoPlay
            className="gv-scan-camera-preview"
            muted
            playsInline
            ref={video}
          />
          <p>Align the scalp within the guide. Image checks are advisory only.</p>
          <Button disabled={pending} onClick={localCapture} type="button" variant="secondary">
            Take local preview
          </Button>
        </>
      ) : null}
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- browser-local preview must not use a remote loader. */}
          <img
            alt="Temporary local capture preview"
            className="gv-scan-local-preview"
            src={preview}
          />
          <p>
            Preview only. Check for blur, low light, orientation, and framing distance before
            continuing.
          </p>
          <Button
            disabled={pending}
            onClick={() => {
              setPreview(null);
              setTechnicalMetrics(null);
              uploadAttempt.current = null;
            }}
            type="button"
            variant="quiet"
          >
            Discard preview
          </Button>
          {uploadState === "failed" ? (
            <InlineMessage announce title="Upload paused" variant="error">
              This image has not been saved. Retry the upload before confirming this angle.
            </InlineMessage>
          ) : null}
          <Button
            disabled={pending || uploadState === "uploaded"}
            onClick={() => {
              void uploadCurrentPreview();
            }}
            type="button"
            variant="secondary"
          >
            {uploadState === "failed" ? "Retry upload" : "Upload image"}
          </Button>
          {uploadState === "uploaded" ? <p>Image uploaded securely.</p> : null}
        </>
      ) : null}
      <div className="gv-scan-capture-actions">
        {isReview ? (
          <>
            <Button
              disabled={pending}
              onClick={() => {
                void send("complete");
              }}
              type="button"
              variant="primary"
            >
              Confirm capture complete
            </Button>
            {state.capture.completedSteps.map((step) => (
              <Button
                disabled={pending}
                key={step}
                onClick={() => {
                  void send("retake", step as Step);
                }}
                type="button"
                variant="secondary"
              >
                Retake {labels[step as Step]}
              </Button>
            ))}
          </>
        ) : isPreparation ? (
          <Button
            disabled={pending}
            onClick={() => {
              void send("complete");
            }}
            type="button"
            variant="primary"
          >
            Start guided capture
          </Button>
        ) : (
          <>
            <Button
              disabled={pending || !preview || uploadState !== "uploaded"}
              onClick={() => {
                void send("complete");
              }}
              type="button"
              variant="primary"
            >
              Confirm this angle
            </Button>
          </>
        )}
      </div>
      {currentQuality?.qualityState ? (
        <InlineMessage
          announce
          title={
            currentQuality.qualityState === "retake_required"
              ? "Retake required"
              : currentQuality.qualityState === "warning"
                ? "Technical warning"
                : currentQuality.qualityState === "passed"
                  ? "Passed"
                  : "Validation pending"
          }
          variant={
            currentQuality.qualityState === "retake_required"
              ? "error"
              : currentQuality.qualityState === "warning"
                ? "information"
                : "success"
          }
        >
          {currentQuality.reasonCode ?? "Technical validation is complete."}
          {currentQuality.qualityState === "retake_required" ? (
            <Button
              disabled={pending}
              onClick={() => {
                void send("retake", state.capture.currentStep);
              }}
              type="button"
              variant="secondary"
            >
              Retake this angle
            </Button>
          ) : null}
        </InlineMessage>
      ) : null}
      {state.readiness.isReady ? (
        <InlineMessage announce title="Scan ready" variant="success">
          All seven required angles satisfy trusted technical readiness.
        </InlineMessage>
      ) : null}
      {error === "disconnected" ? (
        <InlineMessage announce title="Connection paused" variant="information">
          Your local preview stays on this device. Reconnect to continue.
        </InlineMessage>
      ) : null}
      {error === "unavailable" ? (
        <InlineMessage announce title="Preview unavailable" variant="error">
          Start the camera before taking a local preview.
        </InlineMessage>
      ) : null}
    </div>
  );
}
