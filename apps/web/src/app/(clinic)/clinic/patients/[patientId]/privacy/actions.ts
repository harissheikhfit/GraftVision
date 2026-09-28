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
  recordPatientPrivacyAcknowledgement,
  withdrawPatientPrivacyAcknowledgement,
} from "@graftvision/database";

export interface PrivacyAcknowledgementActionState {
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
    throw new Error("Privacy acknowledgement context unavailable.");
  }
  return {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
}

export async function acknowledgePrivacyNoticeAction(
  _state: PrivacyAcknowledgementActionState,
  formData: FormData,
): Promise<PrivacyAcknowledgementActionState> {
  const patientId = formData.get("patientId");
  const language = formData.get("language");
  const noticeVersionId = formData.get(
    language === "ur" ? "noticeVersionIdUr" : "noticeVersionIdEn",
  );
  const revision = formData.get("revision");
  const idempotencyKey = formData.get("idempotencyKey");
  const explicitAcknowledgement = formData.get("explicitAcknowledgement");
  if (
    typeof patientId !== "string" ||
    typeof noticeVersionId !== "string" ||
    (language !== "en" && language !== "ur") ||
    typeof revision !== "string" ||
    typeof idempotencyKey !== "string" ||
    explicitAcknowledgement !== "yes"
  ) {
    return { message: "Explicit acknowledgement is required.", status: "error" };
  }
  const pool = createDatabasePool();
  try {
    await recordPatientPrivacyAcknowledgement(pool, {
      ...(await trustedContext()),
      channel: "IN_PERSON_CLINIC",
      expectedRevision: Number.parseInt(revision, 10),
      idempotencyKey,
      language,
      noticeVersionId,
      patientId,
    });
    revalidatePath(`/clinic/patients/${patientId}/privacy`);
    return { message: "Privacy notice acknowledgement recorded.", status: "success" };
  } catch {
    return { message: "Acknowledgement could not be recorded.", status: "error" };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function withdrawPrivacyAcknowledgementAction(
  _state: PrivacyAcknowledgementActionState,
  formData: FormData,
): Promise<PrivacyAcknowledgementActionState> {
  const patientId = formData.get("patientId");
  const revision = formData.get("revision");
  const idempotencyKey = formData.get("idempotencyKey");
  const confirmedRequest = formData.get("confirmedRequest");
  if (
    typeof patientId !== "string" ||
    typeof revision !== "string" ||
    typeof idempotencyKey !== "string" ||
    confirmedRequest !== "yes"
  ) {
    return { message: "A verified patient request is required.", status: "error" };
  }
  const pool = createDatabasePool();
  try {
    await withdrawPatientPrivacyAcknowledgement(pool, {
      ...(await trustedContext()),
      expectedRevision: Number.parseInt(revision, 10),
      idempotencyKey,
      patientId,
    });
    revalidatePath(`/clinic/patients/${patientId}/privacy`);
    return { message: "Privacy acknowledgement withdrawn prospectively.", status: "success" };
  } catch {
    return { message: "Withdrawal could not be recorded.", status: "error" };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
