"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  transitionConsultationStatus,
  type ConsultationStatusReasonCode,
} from "@graftvision/database";

export interface ConsultationTransitionActionState {
  readonly status?: "conflict" | "error";
}

export interface ConsultationTransitionActionContext {
  readonly consultationId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly newStatus: "cancelled" | "in-progress";
  readonly patientId: string;
  readonly reasonCode: ConsultationStatusReasonCode;
}

export async function transitionConsultationStatusAction(
  context: ConsultationTransitionActionContext,
  _state: ConsultationTransitionActionState,
  _formData: FormData,
): Promise<ConsultationTransitionActionState> {
  const authClient = await createRequestAuthClient();
  const destination = `/clinic/patients/${context.patientId}/consultations/${context.consultationId}`;
  try {
    await requireVerifiedAuthSession(authClient, "clinic");
    const [user, session] = await Promise.all([
      getCurrentUser(authClient),
      getActiveApplicationSession(),
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
      return { status: "error" };
    }
    const pool = createDatabasePool();
    try {
      const result = await transitionConsultationStatus(pool, {
        applicationSessionId: session.id,
        consultationId: context.consultationId,
        expectedRevision: context.expectedRevision,
        idempotencyKey: context.idempotencyKey,
        newStatus: context.newStatus,
        providerIdentityId: user.platformUserId,
        reasonCode: context.reasonCode,
      });
      if (result.outcome === "stale_revision") {
        return { status: "conflict" };
      }
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return { status: "error" };
  }
  revalidatePath(destination);
  redirect(`${destination}?updated=true`);
}
