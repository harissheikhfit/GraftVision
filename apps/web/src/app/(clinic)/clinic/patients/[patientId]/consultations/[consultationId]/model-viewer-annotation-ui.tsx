import { type Dispatch, type SetStateAction } from "react";

import type {
  CurveCode,
  LandmarkCode,
  RegionCode,
  SmoothingMode,
  ModelAnnotationEventValue,
} from "@graftvision/database";

export type AnnotationMode = "idle" | "landmark" | "curve" | "region";

export interface DraftLandmark {
  id: string; // temp uuid
  code: LandmarkCode;
  x: number;
  y: number;
  z: number;
  surfaceReference: string | null;
  savedVersionId?: string; // If loaded from DB
}

export interface DraftCurvePoint {
  id: string;
  order_index: number;
  x: number;
  y: number;
  z: number;
}

export interface DraftCurve {
  id: string; // temp uuid
  code: CurveCode;
  points: DraftCurvePoint[];
  closed: boolean;
  smoothingMode: SmoothingMode;
  savedVersionId?: string;
}

export interface DraftRegion {
  id: string;
  code: RegionCode;
  points: DraftCurvePoint[];
  savedVersionId?: string;
}

export interface AnnotationDraftState {
  landmarks: DraftLandmark[];
  curves: DraftCurve[];
  regions: DraftRegion[];
}

export type AnnotationAction =
  | { type: "RESET"; payload: AnnotationDraftState }
  | { type: "ADD_LANDMARK"; payload: DraftLandmark }
  | { type: "UPDATE_LANDMARK"; payload: DraftLandmark }
  | { type: "DELETE_LANDMARK"; payload: string }
  | { type: "ADD_CURVE"; payload: DraftCurve }
  | { type: "UPDATE_CURVE"; payload: DraftCurve }
  | { type: "DELETE_CURVE"; payload: string }
  | { type: "ADD_REGION"; payload: DraftRegion }
  | { type: "UPDATE_REGION"; payload: DraftRegion }
  | { type: "DELETE_REGION"; payload: string };

export function annotationReducer(
  state: AnnotationDraftState,
  action: AnnotationAction,
): AnnotationDraftState {
  switch (action.type) {
    case "RESET":
      return action.payload;
    case "ADD_LANDMARK":
      return { ...state, landmarks: [...state.landmarks, action.payload] };
    case "UPDATE_LANDMARK":
      return {
        ...state,
        landmarks: state.landmarks.map((l) => (l.id === action.payload.id ? action.payload : l)),
      };
    case "DELETE_LANDMARK":
      return {
        ...state,
        landmarks: state.landmarks.filter((l) => l.id !== action.payload),
      };
    case "ADD_CURVE":
      return { ...state, curves: [...state.curves, action.payload] };
    case "UPDATE_CURVE":
      return {
        ...state,
        curves: state.curves.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };
    case "DELETE_CURVE":
      return {
        ...state,
        curves: state.curves.filter((c) => c.id !== action.payload),
      };
    case "ADD_REGION":
      return { ...state, regions: [...state.regions, action.payload] };
    case "UPDATE_REGION":
      return {
        ...state,
        regions: state.regions.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };
    case "DELETE_REGION":
      return {
        ...state,
        regions: state.regions.filter((r) => r.id !== action.payload),
      };
  }
}

export function AnnotationToolbar({
  mode,
  setMode,
  selectedLandmarkCode,
  setSelectedLandmarkCode,
  selectedCurveCode,
  setSelectedCurveCode,
  selectedRegionCode,
  setSelectedRegionCode,
  isEditingCurve,
  setIsEditingCurve,
  isEditingRegion,
  setIsEditingRegion,
  curveClosed,
  setCurveClosed,
  curveSmoothing,
  setCurveSmoothing,
  canUndo,
  canRedo,
  undo,
  redo,
  reset,
  save,
  isSaving,
  isFinalized,
  finalize,
  isFinalizing,
  createDraft,
  isCreatingDraft,
  history,
}: {
  mode: AnnotationMode;
  setMode: Dispatch<SetStateAction<AnnotationMode>>;
  selectedLandmarkCode: LandmarkCode;
  setSelectedLandmarkCode: Dispatch<SetStateAction<LandmarkCode>>;
  selectedCurveCode: CurveCode;
  setSelectedCurveCode: Dispatch<SetStateAction<CurveCode>>;
  selectedRegionCode: RegionCode;
  setSelectedRegionCode: Dispatch<SetStateAction<RegionCode>>;
  isEditingCurve: boolean;
  setIsEditingCurve: Dispatch<SetStateAction<boolean>>;
  isEditingRegion: boolean;
  setIsEditingRegion: Dispatch<SetStateAction<boolean>>;
  curveClosed: boolean;
  setCurveClosed: Dispatch<SetStateAction<boolean>>;
  curveSmoothing: SmoothingMode;
  setCurveSmoothing: Dispatch<SetStateAction<SmoothingMode>>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  save: () => void;
  isSaving: boolean;
  isFinalized: boolean;
  finalize: () => void;
  isFinalizing: boolean;
  createDraft: () => void;
  isCreatingDraft: boolean;
  history: ModelAnnotationEventValue[];
}) {
  return (
    <div
      className="gv-annotation-toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px",
        background: "var(--gv-presentation-surface)",
      }}
    >
      <button
        onClick={() => {
          setMode(mode === "idle" ? "landmark" : "idle");
        }}
        type="button"
        disabled={isFinalized}
      >
        {mode === "idle" ? "Enter Annotation Mode" : "Exit Annotation Mode"}
      </button>

      {mode !== "idle" && (
        <>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as AnnotationMode);
            }}
            aria-label="Annotation Tool"
            disabled={isFinalized}
          >
            <option value="landmark">Landmark Tool</option>
            <option value="curve">Curve Tool</option>
            <option value="region">Region Tool</option>
          </select>

          {mode === "landmark" && (
            <select
              value={selectedLandmarkCode}
              onChange={(e) => {
                setSelectedLandmarkCode(e.target.value as LandmarkCode);
              }}
              aria-label="Landmark Type"
              disabled={isFinalized}
            >
              <option value="glabella_reference">Glabella</option>
              <option value="frontal_midline_reference">Frontal Midline</option>
              <option value="left_temporal_reference">Left Temporal</option>
              <option value="right_temporal_reference">Right Temporal</option>
              <option value="crown_center_reference">Crown Center</option>
              <option value="left_occipital_reference">Left Occipital</option>
              <option value="right_occipital_reference">Right Occipital</option>
              <option value="donor_center_reference">Donor Center</option>
              <option value="custom_technical_reference">Custom</option>
            </select>
          )}

          {mode === "curve" && (
            <>
              <select
                value={selectedCurveCode}
                onChange={(e) => {
                  setSelectedCurveCode(e.target.value as CurveCode);
                }}
                aria-label="Curve Type"
                disabled={isFinalized}
              >
                <option value="current_hairline">Current Hairline</option>
                <option value="proposed_hairline">Proposed Hairline</option>
                <option value="frontal_boundary">Frontal Boundary</option>
                <option value="left_temporal_boundary">Left Temporal Boundary</option>
                <option value="right_temporal_boundary">Right Temporal Boundary</option>
                <option value="donor_upper_boundary">Donor Upper Boundary</option>
                <option value="donor_lower_boundary">Donor Lower Boundary</option>
                <option value="donor_left_boundary">Donor Left Boundary</option>
                <option value="donor_right_boundary">Donor Right Boundary</option>
                <option value="crown_boundary">Crown Boundary</option>
              </select>

              <select
                value={curveSmoothing}
                onChange={(e) => {
                  setCurveSmoothing(e.target.value as SmoothingMode);
                }}
                aria-label="Curve Smoothing"
                disabled={isFinalized}
              >
                <option value="linear">Linear</option>
                <option value="catmull_rom">Catmull-Rom</option>
              </select>

              <label>
                <input
                  type="checkbox"
                  checked={curveClosed}
                  onChange={(e) => {
                    setCurveClosed(e.target.checked);
                  }}
                  disabled={isFinalized}
                />
                Closed Loop
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsEditingCurve(!isEditingCurve);
                }}
                disabled={isFinalized}
              >
                {isEditingCurve ? "Finish Curve" : "Start Curve"}
              </button>
            </>
          )}

          {mode === "region" && (
            <>
              <select
                value={selectedRegionCode}
                onChange={(e) => {
                  setSelectedRegionCode(e.target.value as RegionCode);
                }}
                aria-label="Region Type"
                disabled={isFinalized}
              >
                <option value="frontal_recipient_region">Frontal Recipient Region</option>
                <option value="mid_scalp_region">Mid Scalp Region</option>
                <option value="crown_region">Crown Region</option>
                <option value="left_temporal_region">Left Temporal Region</option>
                <option value="right_temporal_region">Right Temporal Region</option>
                <option value="donor_rear_region">Donor Rear Region</option>
                <option value="donor_left_region">Donor Left Region</option>
                <option value="donor_right_region">Donor Right Region</option>
                <option value="exclusion_region">Exclusion Region</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setIsEditingRegion(!isEditingRegion);
                }}
                disabled={isFinalized}
              >
                {isEditingRegion ? "Finish Region" : "Start Region"}
              </button>
            </>
          )}

          <button onClick={undo} disabled={!canUndo || isSaving || isFinalized} type="button">
            Undo
          </button>
          <button onClick={redo} disabled={!canRedo || isSaving || isFinalized} type="button">
            Redo
          </button>
          <button onClick={reset} disabled={isSaving || isFinalized} type="button">
            Reset
          </button>
          <button onClick={save} disabled={isSaving || isFinalized} type="button">
            {isSaving ? "Saving..." : "Save Draft"}
          </button>

          {!isFinalized && (
            <button onClick={finalize} disabled={isFinalizing || isSaving} type="button">
              {isFinalizing ? "Finalizing..." : "Finalize Package"}
            </button>
          )}

          {isFinalized && (
            <button onClick={createDraft} disabled={isCreatingDraft} type="button">
              {isCreatingDraft ? "Creating..." : "Create New Draft"}
            </button>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="gv-annotation-history" style={{ width: "100%", marginTop: "16px" }}>
          <h3>History</h3>
          <ul style={{ maxHeight: "150px", overflowY: "auto", listStyle: "none", padding: 0 }}>
            {history.map((evt) => (
              <li
                key={`${evt.version_revision}-${evt.event_type}-${evt.annotation_code}-${evt.created_at}`}
                style={{
                  fontSize: "12px",
                  borderBottom: "var(--gv-border-default)",
                  padding: "4px 0",
                }}
              >
                <strong>{evt.event_type}</strong> - {evt.annotation_kind} ({evt.annotation_code}) -{" "}
                {new Date(evt.created_at).toLocaleString()}
                <br />
                State: {evt.lifecycle_state} | Rev: {evt.version_revision}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
