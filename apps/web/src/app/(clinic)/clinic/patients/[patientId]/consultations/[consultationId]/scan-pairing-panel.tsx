"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button, InlineMessage, Section } from "@graftvision/ui";

import {
  createScanPairingAction,
  revokeScanPairingAction,
  type ScanPairingActionState,
} from "./scan-pairing-actions";

import type { ScanQualityActionState } from "./scan-quality-actions";

const initialState: ScanPairingActionState = {};
const previewAngles = [
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
] as const;

const qualityReasons = [
  "IMAGE_TOO_BLURRY",
  "IMAGE_TOO_DARK",
  "IMAGE_TOO_BRIGHT",
  "IMAGE_TOO_SMALL",
  "INVALID_ORIENTATION",
  "HEAD_OUT_OF_FRAME",
  "SUBJECT_TOO_CLOSE",
  "SUBJECT_TOO_FAR",
  "DUPLICATE_ANGLE_IMAGE",
  "ANGLE_MISMATCH",
  "ASSET_REPLACED",
  "QUALITY_CHECK_FAILED",
] as const;
const overrideReasons = [
  "ACCEPTABLE_FOR_TECHNICAL_REVIEW",
  "CAPTURE_LIMITATION_ACKNOWLEDGED",
  "NO_SAFE_RETAKE_AVAILABLE",
  "WORKFLOW_RECOVERY",
] as const;
type QualityAction = (
  state: ScanQualityActionState,
  formData: FormData,
) => Promise<ScanQualityActionState>;

export function ScanPairingPanel({
  consultationId,
  patientId,
  ready,
  createHandoffAction,
  overrideQualityAction,
  requestRetakeAction,
}: {
  readonly consultationId: string;
  readonly patientId: string;
  readonly ready: boolean;
  readonly createHandoffAction: QualityAction;
  readonly overrideQualityAction: QualityAction;
  readonly requestRetakeAction: QualityAction;
}) {
  const [state, createAction, creating] = useActionState(
    createScanPairingAction.bind(null, { consultationId, patientId }),
    initialState,
  );
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeScanPairingAction.bind(null, { consultationId, patientId }),
    initialState,
  );
  const [now, setNow] = useState<number | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<
    "completed" | "created" | "expired" | "paired" | "revoked" | null
  >(null);
  const [capture, setCapture] = useState<{
    readonly completedSteps: readonly string[];
    readonly currentStep: string;
    readonly lastActivityAt: string;
  } | null>(null);
  const [quality, setQuality] = useState<
    readonly {
      readonly assetId: string | null;
      readonly captureStep: string;
      readonly qualityRevision: number | null;
      readonly qualityState: string | null;
      readonly reasonCode: string | null;
      readonly stale: boolean;
    }[]
  >([]);
  const [readiness, setReadiness] = useState<{
    readonly blockerCodes: readonly string[];
    readonly isReady: boolean;
    readonly qualityReviewRevision: number;
  } | null>(null);
  const [previews, setPreviews] = useState<Readonly<Partial<Record<string, string>>>>({});
  const [activePreview, setActivePreview] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [retakeState, retakeAction, retaking] = useActionState(requestRetakeAction, {});
  const [overrideState, overrideAction, overriding] = useActionState(overrideQualityAction, {});
  const [handoffState, handoffAction, handingOff] = useActionState(createHandoffAction, {});
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!state.scanSessionId || state.status !== "created") return;
    const readStatus = async () => {
      const response = await fetch(`/api/scan-sessions/${state.scanSessionId}/status`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const result = (await response.json()) as {
        capture?: {
          completedSteps: readonly string[];
          currentStep: string;
          lastActivityAt: string;
        };
        status?: "completed" | "created" | "expired" | "paired" | "revoked";
        quality?: typeof quality;
        readiness?: typeof readiness;
      };
      if (result.status) setRemoteStatus(result.status);
      if (result.capture) setCapture(result.capture);
      if (result.quality) setQuality(result.quality);
      if (result.readiness) setReadiness(result.readiness);
    };
    void readStatus();
    const timer = window.setInterval(() => {
      void readStatus();
    }, 2_500);
    return () => {
      window.clearInterval(timer);
    };
  }, [state.scanSessionId, state.status]);
  const remaining =
    state.expiresAt && now !== null ? Math.max(0, new Date(state.expiresAt).getTime() - now) : 1;
  const effectiveStatus =
    remoteStatus ?? (remaining === 0 ? "expired" : (state.status ?? "created"));
  const isExpired = effectiveStatus === "expired";
  const activePreviewAngle = activePreview === null ? null : (previewAngles[activePreview] ?? null);
  const actionStates: readonly (readonly [string, ScanQualityActionState])[] = [
    ["retake", retakeState],
    ["override", overrideState],
    ["handoff", handoffState],
  ];
  const loadPreview = async (
    assetId: string,
    angle: string,
    index: number,
    button: HTMLButtonElement,
  ) => {
    trigger.current = button;
    const response = await fetch(`/api/scan-sessions/${state.scanSessionId}/media/${assetId}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return;
    const result = (await response.json()) as { readonly url?: string };
    if (!result.url) return;
    setPreviews((current) => ({ ...current, [angle]: result.url }));
    setActivePreview(index);
  };

  useEffect(() => {
    if (activePreview === null) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePreview(null);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
    };
  }, [activePreview]);

  return (
    <Section heading="Phone pairing">
      {!ready ? (
        <InlineMessage title="Scan unavailable" variant="information">
          Complete the required clinical review before starting a scan.
        </InlineMessage>
      ) : effectiveStatus !== "created" || isExpired ? (
        <form action={createAction}>
          <Button disabled={creating} type="submit" variant="primary">
            {effectiveStatus === "paired" ? "Start another scan" : "Generate new pairing code"}
          </Button>
        </form>
      ) : (
        <div aria-live="polite">
          <p>
            Waiting for the authorised clinic device. Expires in {Math.ceil(remaining / 1000)}{" "}
            seconds.
          </p>
          {state.qrDataUrl ? (
            <Image
              alt="QR code for secure phone pairing"
              height={256}
              src={state.qrDataUrl}
              unoptimized
              width={256}
            />
          ) : null}
          <p>
            Manual pairing code: <code>{state.manualCode}</code>
          </p>
          <p>
            Use the QR code or enter the code on the clinic phone. It is shown only for this active
            session.
          </p>
          <form action={revokeAction}>
            <input name="scanSessionId" type="hidden" value={state.scanSessionId} />
            <Button disabled={revoking} type="submit" variant="secondary">
              Revoke pairing code
            </Button>
          </form>
        </div>
      )}
      {effectiveStatus === "paired" ? (
        <InlineMessage announce title="Phone paired" variant="success">
          The authorised device is paired.{" "}
          {capture
            ? `Current step: ${capture.currentStep.replaceAll("_", " ")}.`
            : "Preparing capture guidance."}
        </InlineMessage>
      ) : null}
      {capture ? (
        <div aria-live="polite">
          <p>Capture progress: {capture.completedSteps.length} of 8 required angles complete.</p>
          <p>Remaining angles: {Math.max(0, 8 - capture.completedSteps.length)}.</p>
          <p>Last activity: {new Date(capture.lastActivityAt).toLocaleTimeString("en-PK")}.</p>
        </div>
      ) : null}
      {state.scanSessionId ? (
        <Section heading="Doctor quality review">
          <div aria-live="polite" className="gv-scan-preview-grid">
            {previewAngles.map((angle, index) => {
              const row = quality.find((item) => item.captureStep === angle);
              const canOverride =
                row?.qualityState === "warning" || row?.qualityState === "retake_required";
              return (
                <article className="gv-scan-preview-slot" key={angle}>
                  <h3>{angle.replaceAll("_", " ")}</h3>
                  <p>
                    {row?.qualityState ?? "Validation pending"}
                    {row?.stale ? " · stale" : ""}
                  </p>
                  <p>{row?.reasonCode ?? "No technical reason"}</p>
                  <p>
                    {row?.qualityRevision ? `Revision ${row.qualityRevision}` : "No current result"}
                  </p>
                  {row?.assetId ? (
                    <Button
                      onClick={(event) => {
                        void loadPreview(row.assetId ?? "", angle, index, event.currentTarget);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      {previews[angle] ? "Refresh secure preview" : "Open secure preview"}
                    </Button>
                  ) : (
                    <InlineMessage title="Preview missing" variant="information">
                      No current upload is available.
                    </InlineMessage>
                  )}
                  {row?.assetId && readiness ? (
                    <form action={retakeAction}>
                      <input name="scanSessionId" type="hidden" value={state.scanSessionId} />
                      <input name="assetId" type="hidden" value={row.assetId} />
                      <input name="captureStep" type="hidden" value={angle} />
                      <input
                        name="expectedRevision"
                        type="hidden"
                        value={readiness.qualityReviewRevision}
                      />
                      <label>
                        Retake reason
                        <select defaultValue="IMAGE_TOO_BLURRY" name="reasonCode">
                          {qualityReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button disabled={retaking} type="submit" variant="secondary">
                        Request retake
                      </Button>
                    </form>
                  ) : null}
                  {row?.assetId && readiness && canOverride ? (
                    <form action={overrideAction}>
                      <input name="scanSessionId" type="hidden" value={state.scanSessionId} />
                      <input name="assetId" type="hidden" value={row.assetId} />
                      <input name="captureStep" type="hidden" value={angle} />
                      <input
                        name="expectedRevision"
                        type="hidden"
                        value={readiness.qualityReviewRevision}
                      />
                      <label>
                        Override reason
                        <select
                          defaultValue="ACCEPTABLE_FOR_TECHNICAL_REVIEW"
                          name="overrideReasonCode"
                        >
                          {overrideReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button disabled={overriding} type="submit" variant="quiet">
                        Record Doctor override
                      </Button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
          {readiness ? (
            <>
              <p>
                {readiness.isReady ? "Scan ready" : "Scan not ready"}:{" "}
                {readiness.qualityReviewRevision} quality revision ·{" "}
                {
                  quality.filter(
                    (item) =>
                      item.qualityState === "passed" || item.qualityState === "doctor_overridden",
                  ).length
                }{" "}
                of 7 ready.
              </p>
              {!readiness.isReady ? (
                <p>{readiness.blockerCodes.join(", ") || "Validation pending"}</p>
              ) : null}
              <form action={handoffAction}>
                <input name="scanSessionId" type="hidden" value={state.scanSessionId} />
                <input
                  name="expectedRevision"
                  type="hidden"
                  value={readiness.qualityReviewRevision}
                />
                <Button disabled={!readiness.isReady || handingOff} type="submit" variant="primary">
                  Send to Analyzer
                </Button>
              </form>
            </>
          ) : (
            <InlineMessage title="Loading quality review" variant="information">
              Loading trusted quality state.
            </InlineMessage>
          )}
          {actionStates.map(([key, actionState]) =>
            actionState.message ? (
              <InlineMessage
                announce
                key={key}
                title="Quality review"
                variant={actionState.status === "success" ? "success" : "error"}
              >
                {actionState.message}
              </InlineMessage>
            ) : null,
          )}
        </Section>
      ) : null}
      {activePreview !== null && activePreviewAngle ? (
        <div aria-label="Secure scan preview" aria-modal="true" role="dialog">
          <Button
            onClick={() => {
              setActivePreview(null);
              trigger.current?.focus();
            }}
            type="button"
            variant="secondary"
          >
            Close preview
          </Button>
          <Button
            onClick={() => {
              setActivePreview((activePreview + previewAngles.length - 1) % previewAngles.length);
            }}
            type="button"
            variant="quiet"
          >
            Previous angle
          </Button>
          <Button
            onClick={() => {
              setActivePreview((activePreview + 1) % previewAngles.length);
            }}
            type="button"
            variant="quiet"
          >
            Next angle
          </Button>
          {previews[activePreviewAngle] ? (
            <Image
              alt={`Secure ${activePreviewAngle.replaceAll("_", " ")} preview`}
              height={800}
              src={previews[activePreviewAngle] ?? ""}
              unoptimized
              width={800}
            />
          ) : (
            <InlineMessage title="Preview expired" variant="information">
              Close and reopen this preview to request a fresh link.
            </InlineMessage>
          )}
        </div>
      ) : null}
      {state.message ? (
        <InlineMessage announce title="Scan pairing" variant="error">
          {state.message}
        </InlineMessage>
      ) : null}
      {revokeState.message ? (
        <InlineMessage
          announce
          title="Scan pairing"
          variant={revokeState.status === "revoked" ? "success" : "error"}
        >
          {revokeState.message}
        </InlineMessage>
      ) : null}
    </Section>
  );
}
