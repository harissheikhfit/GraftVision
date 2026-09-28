"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  queueAiMapProposal,
  importAiMapSuggestionToDraft,
  recordAiMapProposalDecision,
  readAiMapProposalPackage,
  type AiMapProposalPackage,
  type AiMapProposalLandmark,
  type AiMapProposalCurve,
  type AiMapProposalRegion,
} from "@graftvision/database";

export interface AiMapActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

export interface AiMapActionState {
  readonly message?: string;
  readonly status?: "conflict" | "denied" | "error" | "success";
  readonly proposalId?: string;
  readonly versionId?: string;
  readonly packageRevision?: number;
}

async function context() {
  const auth = await createRequestAuthClient();
  await requireVerifiedAuthSession(auth, "clinic");
  const [session, user] = await Promise.all([getActiveApplicationSession(), getCurrentUser(auth)]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
    throw new Error("AI_MAP_DENIED");
  return { session, user };
}

function state(error: unknown): AiMapActionState {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CONFLICT"))
    return {
      message: "The model was updated by someone else. Please refresh.",
      status: "conflict",
    };
  if (message.includes("DENIED"))
    return {
      message: "You are not permitted to perform this action.",
      status: "denied",
    };
  return {
    message: "An unexpected error occurred while communicating with the database.",
    status: "error",
  };
}

export async function readAiMapProposalPackageAction(
  _ctx: AiMapActionContext,
  scanSessionId: string,
): Promise<{
  proposalPackage: AiMapProposalPackage | null;
  landmarks: AiMapProposalLandmark[];
  curves: AiMapProposalCurve[];
  regions: AiMapProposalRegion[];
}> {
  try {
    await context(); // Validate auth
    const pool = createDatabasePool();
    try {
      return await readAiMapProposalPackage(pool, { scanSessionId });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch (error) {
    throw new Error("Failed to read AI map proposal.", { cause: error });
  }
}

export async function queueAiMapProposalAction(
  ctx: AiMapActionContext,
  scanSessionId: string,
  analyzerHandoffId: string,
  idempotencyKey?: string,
): Promise<AiMapActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();

    let proposalId;
    try {
      const result = await queueAiMapProposal(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        scanSessionId,
        analyzerHandoffId,
        idempotencyKey: idempotencyKey ?? randomUUID(),
      });
      proposalId = result.proposalId;
    } finally {
      await pool.end().catch(() => undefined);
    }

    revalidatePath(`/clinic/patients/${ctx.patientId}/consultations/${ctx.consultationId}`);
    return { status: "success", proposalId };
  } catch (error) {
    return state(error);
  }
}

export async function importAiMapSuggestionToDraftAction(
  _ctx: AiMapActionContext,
  annotationPackageId: string,
  suggestionId: string,
  suggestionKind: "landmark" | "curve" | "region",
  expectedPackageRevision: number,
  idempotencyKey?: string,
): Promise<AiMapActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();

    let versionId, packageRevision;
    try {
      const result = await importAiMapSuggestionToDraft(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId,
        suggestionId,
        suggestionKind,
        expectedPackageRevision,
        idempotencyKey: idempotencyKey ?? randomUUID(),
      });
      versionId = result.versionId;
      packageRevision = result.packageRevision;
    } finally {
      await pool.end().catch(() => undefined);
    }

    return { status: "success", versionId, packageRevision };
  } catch (error) {
    return state(error);
  }
}

export async function recordAiMapProposalDecisionAction(
  _ctx: AiMapActionContext,
  proposalPackageId: string,
  suggestionId: string,
  suggestionKind: "landmark" | "curve" | "region",
  decisionType: "accepted" | "rejected" | "modified",
  idempotencyKey?: string,
): Promise<AiMapActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();

    try {
      await recordAiMapProposalDecision(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        proposalPackageId,
        suggestionId,
        suggestionKind,
        decisionType,
        idempotencyKey: idempotencyKey ?? randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }

    return { status: "success" };
  } catch (error) {
    return state(error);
  }
}
