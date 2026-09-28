import { type Dispatch, type SetStateAction } from "react";

import type {
  AiMapProposalPackage,
  AiMapProposalLandmark,
  AiMapProposalCurve,
  AiMapProposalRegion,
} from "@graftvision/database";

import type { AiMapSuggestionDecision } from "./use-ai-map-proposal";

export function AiMapProposalToolbar({
  proposalPackage,
  isLoading,
  isPending,
  error,
  loadProposal,
  queueProposal,
  showAiLayer,
  setShowAiLayer,
  showDoctorDraft,
  setShowDoctorDraft,
  showFinalized,
  setShowFinalized,
  selectedSuggestionId,
  landmarks,
  curves,
  regions,
  decisions,
  recordDecision,
  importSuggestion,
}: {
  proposalPackage: AiMapProposalPackage | null;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  loadProposal: () => void;
  queueProposal: () => void;
  showAiLayer: boolean;
  setShowAiLayer: Dispatch<SetStateAction<boolean>>;
  showDoctorDraft: boolean;
  setShowDoctorDraft: Dispatch<SetStateAction<boolean>>;
  showFinalized: boolean;
  setShowFinalized: Dispatch<SetStateAction<boolean>>;
  selectedSuggestionId: string | null;
  landmarks: AiMapProposalLandmark[];
  curves: AiMapProposalCurve[];
  regions: AiMapProposalRegion[];
  decisions: Record<string, AiMapSuggestionDecision>;
  recordDecision: (
    id: string,
    kind: "landmark" | "curve" | "region",
    decision: "accepted" | "rejected" | "modified",
  ) => void;
  importSuggestion: (id: string, kind: "landmark" | "curve" | "region") => Promise<boolean>;
}) {
  const selectedSuggestionKind = landmarks.some((l) => l.id === selectedSuggestionId)
    ? "landmark"
    : curves.some((c) => c.id === selectedSuggestionId)
      ? "curve"
      : regions.some((r) => r.id === selectedSuggestionId)
        ? "region"
        : null;

  const handleImport = async () => {
    if (!selectedSuggestionId || !selectedSuggestionKind) return;
    const ok = await importSuggestion(selectedSuggestionId, selectedSuggestionKind);
    if (!ok) {
      // Conflict could be handled here or inside the import logic
    }
  };

  const handleAccept = () => {
    if (!selectedSuggestionId || !selectedSuggestionKind) return;
    recordDecision(selectedSuggestionId, selectedSuggestionKind, "accepted");
  };

  const handleReject = () => {
    if (!selectedSuggestionId || !selectedSuggestionKind) return;
    recordDecision(selectedSuggestionId, selectedSuggestionKind, "rejected");
  };

  const statusMap = {
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    stale: "Stale",
    superseded: "Superseded",
  };

  return (
    <div
      className="gv-ai-map-toolbar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "8px",
        background: "var(--gv-presentation-background)",
        color: "var(--gv-color-text-primary)",
        border: "1px solid var(--gv-color-border)",
        borderRadius: "4px",
        marginTop: "8px",
      }}
    >
      <div style={{ fontWeight: "bold", color: "var(--gv-color-warning-text)" }}>
        Development synthetic AI proposal — Doctor review required.
      </div>
      {error && <div style={{ color: "var(--gv-color-error-text)" }}>{error}</div>}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <strong>AI Proposal Status:</strong>
        {proposalPackage ? (
          <span>{statusMap[proposalPackage.package_state]}</span>
        ) : (
          <span>Not generated</span>
        )}
        <button onClick={loadProposal} disabled={isLoading || isPending} type="button">
          Load Proposal
        </button>
        <button onClick={queueProposal} disabled={isLoading || isPending} type="button">
          Request AI Generation
        </button>
      </div>

      {proposalPackage?.package_state === "completed" && (
        <>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <strong>Layers:</strong>
            <label>
              <input
                type="checkbox"
                checked={showAiLayer}
                onChange={(e) => {
                  setShowAiLayer(e.target.checked);
                }}
              />{" "}
              AI Proposal
            </label>
            <label>
              <input
                type="checkbox"
                checked={showDoctorDraft}
                onChange={(e) => {
                  setShowDoctorDraft(e.target.checked);
                }}
              />{" "}
              Doctor Draft
            </label>
            <label>
              <input
                type="checkbox"
                checked={showFinalized}
                onChange={(e) => {
                  setShowFinalized(e.target.checked);
                }}
              />{" "}
              Finalized
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <strong>Overall Confidence:</strong>{" "}
            <span>
              {proposalPackage.overall_confidence != null
                ? (proposalPackage.overall_confidence * 100).toFixed(1) + "%"
                : "N/A"}
            </span>{" "}
            | <strong>Quality:</strong> <span>{proposalPackage.quality_state || "N/A"}</span>
          </div>

          {selectedSuggestionId && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
                padding: "8px",
                background: "var(--gv-presentation-surface)",
                borderRadius: "4px",
              }}
            >
              <strong>Selected AI Suggestion</strong>
              <span>Status: {decisions[selectedSuggestionId] || "pending"}</span>
              <button
                onClick={handleAccept}
                disabled={isPending || decisions[selectedSuggestionId] === "accepted"}
                type="button"
              >
                Accept
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || decisions[selectedSuggestionId] === "rejected"}
                type="button"
              >
                Reject
              </button>
              <button
                onClick={() => void handleImport()}
                disabled={isPending || decisions[selectedSuggestionId] === "imported"}
                type="button"
              >
                Import to Draft
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
