"use client";

import { useCallback, useRef, useState } from "react";

const pointCloudModes = new Set(["sparse_point_cloud", "dense_point_cloud"]);
const supportedModes = new Set([
  "synthetic_mesh",
  "sparse_point_cloud",
  "dense_point_cloud",
  "surface_mesh",
]);

type SupportedModelMode =
  "synthetic_mesh" | "sparse_point_cloud" | "dense_point_cloud" | "surface_mesh";
type ViewerStatus =
  "idle" | "loading" | "available" | "denied" | "expired" | "failed" | "unsupported";

function isSupportedMode(mode: string): mode is SupportedModelMode {
  return supportedModes.has(mode);
}

export function ModelViewer({
  modelPackageId,
  mode,
}: {
  readonly modelPackageId: string;
  readonly mode: string;
  readonly scanSessionId?: string;
  readonly analyzerHandoffId?: string;
  readonly consultationId?: string;
  readonly patientId?: string;
  readonly annotationPackageId?: string;
  readonly annotationPackageRevision?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [pointSize, setPointSize] = useState(2);
  const [wireframe, setWireframe] = useState(false);
  const [status, setStatus] = useState<ViewerStatus>(
    isSupportedMode(mode) ? "idle" : "unsupported",
  );

  const loadModel = useCallback(async () => {
    if (!isSupportedMode(mode) || !host.current) {
      setStatus("unsupported");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(`/api/model-packages/${modelPackageId}/artifact`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as { readonly url?: string } | null;

      if (!response.ok || !payload?.url) {
        setStatus(response.status === 401 || response.status === 403 ? "denied" : "failed");
        return;
      }

      setStatus("available");
    } catch {
      setStatus("failed");
    }
  }, [mode, modelPackageId]);

  const statusText: Record<ViewerStatus, string> = {
    available: "Model loaded.",
    denied: "Model access is not available.",
    expired: "Model access expired. Request a fresh preview to continue.",
    failed: "The model could not be displayed safely.",
    idle: "Model preview has not been loaded.",
    loading: "Loading model preview.",
    unsupported: "This model format is not supported in the viewer.",
  };

  return (
    <section aria-label="3D scalp model" className="gv-model-viewer">
      <p aria-live="polite" role="status">
        {statusText[status]}
      </p>

      <div
        aria-label={`${mode.replaceAll("_", " ")} model viewport`}
        className="gv-model-viewer__viewport"
        ref={host}
      />

      <div aria-label="Model viewer controls" className="gv-model-viewer__controls" role="group">
        <button
          disabled={status === "loading" || status === "unsupported"}
          onClick={() => void loadModel()}
          type="button"
        >
          {status === "expired" ? "Refresh preview" : status === "idle" ? "Load model" : "Retry"}
        </button>

        <button disabled={status !== "available"} type="button">
          Fit to view
        </button>
        <button disabled={status !== "available"} type="button">
          Reset camera
        </button>

        {(["front", "left", "right", "rear", "top"] as const).map((preset) => (
          <button disabled={status !== "available"} key={preset} type="button">
            {preset.charAt(0).toUpperCase() + preset.slice(1)} view
          </button>
        ))}

        {!pointCloudModes.has(mode) ? (
          <button
            aria-pressed={wireframe}
            disabled={status !== "available"}
            onClick={() => {
              setWireframe((value) => !value);
            }}
            type="button"
          >
            Wireframe
          </button>
        ) : (
          <label>
            Point size
            <input
              aria-label="Point size"
              disabled={status !== "available"}
              max="10"
              min="1"
              onChange={(event) => {
                setPointSize(Number(event.target.value));
              }}
              type="range"
              value={pointSize}
            />
          </label>
        )}

        <button disabled={status !== "available"} type="button">
          Fullscreen
        </button>
      </div>
    </section>
  );
}
