"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { getSessionEnvironment } from "@graftvision/config/env/session";
import {
  createDatabasePool,
  createScanSession,
  generateScanToken,
  getConsultationAnalyzerReadiness,
  hashScanToken,
  transitionScanSessionStatus,
} from "@graftvision/database";

export interface ScanPairingActionState {
  readonly expiresAt?: string;
  readonly manualCode?: string;
  readonly message?: string;
  readonly pairingUrl?: string;
  readonly qrDataUrl?: string;
  readonly scanSessionId?: string;
  readonly status?: "created" | "error" | "revoked";
}

export interface ScanPairingActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

const scanOrigin = "http://localhost:3001";

async function clinicalContext() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (
    !session ||
    session.authorityScope !== "clinic" ||
    !session.clinicId ||
    session.clinicId !== user.clinicId
  ) {
    throw new Error("SCAN_CONTEXT_DENIED");
  }
  return { clinicId: session.clinicId, session, user };
}

export async function createScanPairingAction(
  context: ScanPairingActionContext,
  _state: ScanPairingActionState,
  _formData: FormData,
): Promise<ScanPairingActionState> {
  try {
    const { clinicId, session, user } = await clinicalContext();
    const pool = createDatabasePool();
    const rawToken = generateScanToken().rawToken;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    try {
      const readiness = await getConsultationAnalyzerReadiness(
        pool,
        clinicId,
        context.consultationId,
      );
      if (!readiness?.isReady)
        return { message: "Scanning is not available for this consultation.", status: "error" };
      const result = await createScanSession(pool, {
        applicationSessionId: session.id,
        consultationId: context.consultationId,
        expiresAt,
        id: randomUUID(),
        idempotencyKey: randomUUID(),
        patientId: context.patientId,
        providerIdentityId: user.platformUserId,
        tokenHash: hashScanToken(rawToken, getSessionEnvironment().APPLICATION_SESSION_SIGNING_KEY),
      });
      const pairingUrl = new URL("/session", scanOrigin);
      pairingUrl.searchParams.set("token", rawToken);
      const value = pairingUrl.toString();
      return {
        expiresAt: expiresAt.toISOString(),
        manualCode: rawToken,
        pairingUrl: value,
        qrDataUrl: await QRCode.toDataURL(value, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
        }),
        scanSessionId: result.id,
        status: "created",
      };
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return { message: "Unable to start a scan session.", status: "error" };
  }
}

export async function revokeScanPairingAction(
  context: ScanPairingActionContext,
  _state: ScanPairingActionState,
  formData: FormData,
): Promise<ScanPairingActionState> {
  try {
    const submittedScanSessionId = formData.get("scanSessionId");
    const scanSessionId = typeof submittedScanSessionId === "string" ? submittedScanSessionId : "";
    const { session, user } = await clinicalContext();
    const pool = createDatabasePool();
    try {
      await transitionScanSessionStatus(pool, {
        applicationSessionId: session.id,
        idempotencyKey: randomUUID(),
        newStatus: "revoked",
        providerIdentityId: user.platformUserId,
        reason: "DOCTOR_REVOKED",
        scanSessionId,
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "The scan session was revoked.", status: "revoked" };
  } catch {
    return { message: "Unable to revoke this scan session.", status: "error" };
  }
}
