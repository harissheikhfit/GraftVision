"use server";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  completeConsultation,
  reopenConsultation,
  type ReopenReasonCode,
} from "@graftvision/database";

export interface ConsultationCompletionActionState {
  readonly message?: string;
  readonly status?: "conflict" | "error" | "success";
}

export interface ConsultationCompletionActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

const text = (form: FormData, name: string): string => (form.get(name) as string) || "".trim();
const number = (form: FormData, name: string): number => Number.parseInt(text(form, name), 10);

async function withClinicalContext<Result>(
  operation: (context: {
    applicationSessionId: string;
    pool: ReturnType<typeof createDatabasePool>;
    providerIdentityId: string;
  }) => Promise<Result>,
): Promise<Result> {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("Clinical context is unavailable.");
  }
  const pool = createDatabasePool();
  try {
    return await operation({
      applicationSessionId: session.id,
      pool,
      providerIdentityId: user.platformUserId,
    });
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function completeConsultationAction(
  context: ConsultationCompletionActionContext,
  _state: ConsultationCompletionActionState,
  form: FormData,
): Promise<ConsultationCompletionActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      completeConsultation(pool, applicationSessionId, providerIdentityId, {
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
      }),
    );

    if (result.outcomeCode === "success") {
      revalidatePath(
        `/clinic/patients/${context.patientId}/consultations/${context.consultationId}`,
      );
      return { status: "success" };
    }

    if (result.outcomeCode === "stale_revision") {
      return {
        status: "conflict",
        message: "The consultation has been updated by another user. Please refresh and try again.",
      };
    }

    return {
      status: "error",
      message: `Failed to complete consultation: ${result.outcomeCode}`,
    };
  } catch (error) {
    console.error("completeConsultationAction error:", error);
    return {
      status: "error",
      message: "An unexpected error occurred while completing the consultation.",
    };
  }
}

export async function reopenConsultationAction(
  context: ConsultationCompletionActionContext,
  _state: ConsultationCompletionActionState,
  form: FormData,
): Promise<ConsultationCompletionActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      reopenConsultation(pool, applicationSessionId, providerIdentityId, {
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
        reopenReasonCode: text(form, "reopenReasonCode") as ReopenReasonCode,
      }),
    );

    if (result.outcomeCode === "success") {
      revalidatePath(
        `/clinic/patients/${context.patientId}/consultations/${context.consultationId}`,
      );
      return { status: "success" };
    }

    if (result.outcomeCode === "stale_revision") {
      return {
        status: "conflict",
        message: "The consultation has been updated by another user. Please refresh and try again.",
      };
    }

    return {
      status: "error",
      message: `Failed to reopen consultation: ${result.outcomeCode}`,
    };
  } catch (error) {
    console.error("reopenConsultationAction error:", error);
    return {
      status: "error",
      message: "An unexpected error occurred while reopening the consultation.",
    };
  }
}
