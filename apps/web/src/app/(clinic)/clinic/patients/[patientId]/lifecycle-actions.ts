"use server";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  archivePatient,
  createDatabasePool,
  restorePatient,
  type PatientArchiveReasonCode,
  type PatientRestoreReasonCode,
} from "@graftvision/database";

export interface PatientLifecycleActionState {
  readonly message?: string;
  readonly status?: "error" | "success";
}

async function trustedContext() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("Patient lifecycle context unavailable.");
  }
  return { applicationSessionId: session.id, providerIdentityId: user.platformUserId };
}

async function transition(
  targetState: "archived" | "current",
  formData: FormData,
): Promise<PatientLifecycleActionState> {
  const patientId = formData.get("patientId");
  const expectedRevision = formData.get("expectedRevision");
  const idempotencyKey = formData.get("idempotencyKey");
  const reasonCode = formData.get("reasonCode");
  const confirmed = formData.get("confirmed");
  if (
    typeof patientId !== "string" ||
    typeof expectedRevision !== "string" ||
    typeof idempotencyKey !== "string" ||
    typeof reasonCode !== "string" ||
    confirmed !== "yes"
  ) {
    return { message: "Confirmation and a controlled reason are required.", status: "error" };
  }
  const pool = createDatabasePool();
  try {
    const context = await trustedContext();
    if (targetState === "archived") {
      await archivePatient(pool, {
        ...context,
        expectedRevision: Number.parseInt(expectedRevision, 10),
        idempotencyKey,
        patientId,
        reasonCode: reasonCode as PatientArchiveReasonCode,
      });
    } else {
      await restorePatient(pool, {
        ...context,
        expectedRevision: Number.parseInt(expectedRevision, 10),
        idempotencyKey,
        patientId,
        reasonCode: reasonCode as PatientRestoreReasonCode,
      });
    }
    revalidatePath("/clinic/patients");
    revalidatePath(`/clinic/patients/${patientId}`);
    return {
      message: targetState === "archived" ? "Patient archived." : "Patient restored.",
      status: "success",
    };
  } catch {
    return {
      message: "The lifecycle change was denied or conflicted with a newer update.",
      status: "error",
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function archivePatientAction(
  _state: PatientLifecycleActionState,
  formData: FormData,
): Promise<PatientLifecycleActionState> {
  return transition("archived", formData);
}

export async function restorePatientAction(
  _state: PatientLifecycleActionState,
  formData: FormData,
): Promise<PatientLifecycleActionState> {
  return transition("current", formData);
}
