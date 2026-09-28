import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AnnotationToolbar, type AnnotationMode } from "./model-viewer-annotation-ui";

test("renders annotation toolbar in idle mode and allows mode change", () => {
  const setMode = vi.fn();

  const props = {
    mode: "idle" as AnnotationMode,
    setMode,
    selectedLandmarkCode: "glabella_reference" as const,
    setSelectedLandmarkCode: vi.fn(),
    selectedCurveCode: "current_hairline" as const,
    setSelectedCurveCode: vi.fn(),
    selectedRegionCode: "frontal_recipient_region" as const,
    setSelectedRegionCode: vi.fn(),
    isEditingCurve: false,
    setIsEditingCurve: vi.fn(),
    isEditingRegion: false,
    setIsEditingRegion: vi.fn(),
    curveClosed: false,
    setCurveClosed: vi.fn(),
    curveSmoothing: "linear" as const,
    setCurveSmoothing: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    save: vi.fn(),
    isSaving: false,
    isFinalized: false,
    finalize: vi.fn(),
    isFinalizing: false,
    createDraft: vi.fn(),
    isCreatingDraft: false,
    history: [],
  };

  const { rerender } = render(<AnnotationToolbar {...props} />);

  expect(screen.getByRole("button", { name: "Enter Annotation Mode" })).toBeDefined();

  fireEvent.click(screen.getByRole("button", { name: "Enter Annotation Mode" }));
  expect(setMode).toHaveBeenCalledWith("landmark");

  // Rerender as if mode changed to 'region'
  rerender(<AnnotationToolbar {...props} mode="region" />);

  expect(screen.getByLabelText("Annotation Tool")).toBeDefined();
  expect(screen.getByLabelText("Region Type")).toBeDefined();
  expect(screen.getByRole("button", { name: "Start Region" })).toBeDefined();
});

test("shows finalization buttons when not finalized", () => {
  const finalize = vi.fn();
  const props = {
    mode: "idle" as AnnotationMode,
    setMode: vi.fn(),
    selectedLandmarkCode: "glabella_reference" as const,
    setSelectedLandmarkCode: vi.fn(),
    selectedCurveCode: "current_hairline" as const,
    setSelectedCurveCode: vi.fn(),
    selectedRegionCode: "frontal_recipient_region" as const,
    setSelectedRegionCode: vi.fn(),
    isEditingCurve: false,
    setIsEditingCurve: vi.fn(),
    isEditingRegion: false,
    setIsEditingRegion: vi.fn(),
    curveClosed: false,
    setCurveClosed: vi.fn(),
    curveSmoothing: "linear" as const,
    setCurveSmoothing: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    save: vi.fn(),
    isSaving: false,
    isFinalized: false,
    finalize,
    isFinalizing: false,
    createDraft: vi.fn(),
    isCreatingDraft: false,
    history: [],
  };

  const { rerender } = render(<AnnotationToolbar {...props} mode="landmark" />);
  const finalizeBtn = screen.getByRole("button", { name: "Finalize Package" });
  expect(finalizeBtn).toBeDefined();
  fireEvent.click(finalizeBtn);
  expect(finalize).toHaveBeenCalled();

  // Test draft creation when finalized
  const createDraft = vi.fn();
  rerender(
    <AnnotationToolbar {...props} mode="landmark" isFinalized={true} createDraft={createDraft} />,
  );
  const draftBtn = screen.getByRole("button", { name: "Create New Draft" });
  expect(draftBtn).toBeDefined();
  fireEvent.click(draftBtn);
  expect(createDraft).toHaveBeenCalled();
});
