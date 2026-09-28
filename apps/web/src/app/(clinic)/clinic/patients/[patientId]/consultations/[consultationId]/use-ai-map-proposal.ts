import { useState, useCallback, useTransition } from "react";

import type {
  AiMapProposalPackage,
  AiMapProposalLandmark,
  AiMapProposalCurve,
  AiMapProposalRegion,
} from "@graftvision/database";

import {
  readAiMapProposalPackageAction,
  queueAiMapProposalAction,
  importAiMapSuggestionToDraftAction,
  recordAiMapProposalDecisionAction,
  type AiMapActionContext,
} from "./ai-map-actions";

export type AiMapSuggestionDecision =
  "pending" | "accepted" | "rejected" | "imported" | "conflicted";

export function useAiMapProposal(
  ctx: AiMapActionContext,
  scanSessionId?: string,
  analyzerHandoffId?: string,
) {
  const [proposalPackage, setProposalPackage] = useState<AiMapProposalPackage | null>(null);
  const [landmarks, setLandmarks] = useState<AiMapProposalLandmark[]>([]);
  const [curves, setCurves] = useState<AiMapProposalCurve[]>([]);
  const [regions, setRegions] = useState<AiMapProposalRegion[]>([]);

  const [decisions, setDecisions] = useState<Record<string, AiMapSuggestionDecision>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadProposal = useCallback(async () => {
    if (!scanSessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await readAiMapProposalPackageAction(ctx, scanSessionId);
      setProposalPackage(result.proposalPackage);
      setLandmarks(result.landmarks);
      setCurves(result.curves);
      setRegions(result.regions);

      const initialDecisions: Record<string, AiMapSuggestionDecision> = {};
      result.landmarks.forEach((l) => {
        initialDecisions[l.id] = "pending";
      });
      result.curves.forEach((c) => {
        initialDecisions[c.id] = "pending";
      });
      result.regions.forEach((r) => {
        initialDecisions[r.id] = "pending";
      });
      setDecisions(initialDecisions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setIsLoading(false);
    }
  }, [ctx, scanSessionId]);

  const queueProposal = useCallback(() => {
    if (!scanSessionId || !analyzerHandoffId) return;
    startTransition(async () => {
      setError(null);
      const res = await queueAiMapProposalAction(ctx, scanSessionId, analyzerHandoffId);
      if (res.status !== "success") {
        setError(res.message || "Failed to queue proposal");
      } else {
        await loadProposal();
      }
    });
  }, [ctx, scanSessionId, analyzerHandoffId, loadProposal]);

  const recordDecision = useCallback(
    (
      suggestionId: string,
      suggestionKind: "landmark" | "curve" | "region",
      decisionType: "accepted" | "rejected" | "modified",
    ) => {
      if (!proposalPackage) return;
      startTransition(async () => {
        setError(null);
        const res = await recordAiMapProposalDecisionAction(
          ctx,
          proposalPackage.id,
          suggestionId,
          suggestionKind,
          decisionType,
        );
        if (res.status === "success") {
          setDecisions((prev) => ({
            ...prev,
            [suggestionId]: decisionType === "modified" ? "imported" : decisionType,
          }));
        } else {
          setError(res.message || "Failed to record decision");
        }
      });
    },
    [ctx, proposalPackage],
  );

  const importSuggestion = useCallback(
    async (
      annotationPackageId: string,
      expectedRevision: number,
      suggestionId: string,
      suggestionKind: "landmark" | "curve" | "region",
    ) => {
      if (!proposalPackage) return null;
      setError(null);
      const res = await importAiMapSuggestionToDraftAction(
        ctx,
        annotationPackageId,
        suggestionId,
        suggestionKind,
        expectedRevision,
      );
      if (res.status === "success") {
        setDecisions((prev) => ({ ...prev, [suggestionId]: "imported" }));
        return res;
      } else if (res.status === "conflict") {
        setDecisions((prev) => ({ ...prev, [suggestionId]: "conflicted" }));
        setError(res.message || "Conflict importing suggestion");
        return null;
      } else {
        setError(res.message || "Failed to import suggestion");
        return null;
      }
    },
    [ctx, proposalPackage],
  );

  return {
    proposalPackage,
    landmarks,
    curves,
    regions,
    decisions,
    isLoading,
    isPending,
    error,
    loadProposal,
    queueProposal,
    recordDecision,
    importSuggestion,
  };
}
