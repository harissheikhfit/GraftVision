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
  createScanAnalyzerHandoff,
  overrideScanQualityResult,
  requestScanQualityRetake,
} from "@graftvision/database";

export interface ScanQualityActionState {
  readonly message?: string;
  readonly status?: "conflict" | "denied" | "error" | "success";
}

export interface ScanQualityActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

async function context() {
  const auth = await createRequestAuthClient();
  await requireVerifiedAuthSession(auth, "clinic");
  const [session, user] = await Promise.all([getActiveApplicationSession(), getCurrentUser(auth)]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
    throw new Error("SCAN_QUALITY_DENIED");
  return { session, user };
}

function value(formData: FormData, name: string): string {
  const submitted = formData.get(name);
  if (typeof submitted !== "string") throw new Error("SCAN_QUALITY_INVALID");
  return submitted;
}

function state(error: unknown): ScanQualityActionState {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CONFLICT") || message.includes("NOT_READY"))
    return { message: "The quality review changed. Refresh and try again.", status: "conflict" };
  if (message.includes("DENIED"))
    return { message: "This action is not available.", status: "denied" };
  return { message: "Unable to update scan quality.", status: "error" };
}

export async function requestScanQualityRetakeAction(
  route: ScanQualityActionContext,
  _previous: ScanQualityActionState,
  formData: FormData,
): Promise<ScanQualityActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    try {
      await requestScanQualityRetake(pool, {
        applicationSessionId: session.id,
        assetId: value(formData, "assetId"),
        captureStep: value(formData, "captureStep"),
        expectedRevision: Number(value(formData, "expectedRevision")),
        idempotencyKey: randomUUID(),
        providerIdentityId: user.platformUserId,
        reasonCode: value(formData, "reasonCode"),
        scanSessionId: value(formData, "scanSessionId"),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return { message: "Retake requested.", status: "success" };
  } catch (error) {
    return state(error);
  }
}

export async function overrideScanQualityResultAction(
  route: ScanQualityActionContext,
  _previous: ScanQualityActionState,
  formData: FormData,
): Promise<ScanQualityActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    try {
      await overrideScanQualityResult(pool, {
        applicationSessionId: session.id,
        assetId: value(formData, "assetId"),
        captureStep: value(formData, "captureStep"),
        expectedRevision: Number(value(formData, "expectedRevision")),
        idempotencyKey: randomUUID(),
        overrideReasonCode: value(formData, "overrideReasonCode"),
        providerIdentityId: user.platformUserId,
        scanSessionId: value(formData, "scanSessionId"),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return { message: "Doctor override recorded.", status: "success" };
  } catch (error) {
    return state(error);
  }
}

export async function createScanAnalyzerHandoffAction(
  route: ScanQualityActionContext,
  _previous: ScanQualityActionState,
  formData: FormData,
): Promise<ScanQualityActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    try {
      await createScanAnalyzerHandoff(pool, {
        applicationSessionId: session.id,
        expectedQualityReviewRevision: Number(value(formData, "expectedRevision")),
        idempotencyKey: randomUUID(),
        providerIdentityId: user.platformUserId,
        scanSessionId: value(formData, "scanSessionId"),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return { message: "Analyzer handoff recorded. No analysis has started.", status: "success" };
  } catch (error) {
    return state(error);
  }
}
