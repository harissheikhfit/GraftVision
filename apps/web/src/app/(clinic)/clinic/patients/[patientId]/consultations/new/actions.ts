"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createConsultation, createDatabasePool } from "@graftvision/database";

export interface CreateConsultationActionState {
  readonly message?: string;
  readonly status?: "error";
}

export interface CreateConsultationActionContext {
  readonly idempotencyKey: string;
  readonly patientId: string;
}

export async function createConsultationAction(
  context: CreateConsultationActionContext,
  _state: CreateConsultationActionState,
  _formData: FormData,
): Promise<CreateConsultationActionState> {
  const authClient = await createRequestAuthClient();
  let destination: string;
  try {
    await requireVerifiedAuthSession(authClient, "clinic");
    const [user, session] = await Promise.all([
      getCurrentUser(authClient),
      getActiveApplicationSession(),
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
      return { message: "The consultation draft could not be created.", status: "error" };
    }
    const pool = createDatabasePool();
    try {
      const consultation = await createConsultation(pool, {
        applicationSessionId: session.id,
        idempotencyKey: context.idempotencyKey,
        patientId: context.patientId,
        providerIdentityId: user.platformUserId,
      });
      destination = `/clinic/patients/${context.patientId}/consultations/${consultation.id}?created=true`;
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return { message: "The consultation draft could not be created.", status: "error" };
  }
  revalidatePath(`/clinic/patients/${context.patientId}`);
  redirect(destination);
}
