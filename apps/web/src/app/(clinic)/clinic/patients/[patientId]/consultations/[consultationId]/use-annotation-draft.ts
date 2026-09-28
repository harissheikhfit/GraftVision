import { useCallback, useState } from "react";

import {
  type AnnotationAction,
  type AnnotationDraftState,
  annotationReducer,
} from "./model-viewer-annotation-ui";

export function useAnnotationDraft(
  initialState: AnnotationDraftState = { landmarks: [], curves: [], regions: [] },
) {
  const [past, setPast] = useState<AnnotationDraftState[]>([]);
  const [present, setPresent] = useState<AnnotationDraftState>(initialState);
  const [future, setFuture] = useState<AnnotationDraftState[]>([]);

  const dispatch = useCallback((action: AnnotationAction) => {
    setPresent((current) => {
      const next = annotationReducer(current, action);
      setPast((p) => [...p, current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((p) => p.slice(0, -1));
    setPresent(previous);
    setFuture((f) => [present, ...f]);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPresent(next);
    setPast((p) => [...p, present]);
  }, [future, present]);

  const reset = useCallback(
    (state: AnnotationDraftState = { landmarks: [], curves: [], regions: [] }) => {
      setPast([]);
      setPresent(state);
      setFuture([]);
    },
    [],
  );

  return {
    present,
    dispatch,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
