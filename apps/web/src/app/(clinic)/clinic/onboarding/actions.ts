"use server";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  attestClinicOnboarding,
  CLINIC_ONBOARDING_ATTESTATION_CODES,
  createDatabasePool,
  type ClinicOnboardingAttestationCode,
} from "@graftvision/database";

export interface ClinicOnboardingActionState {
  readonly message?: string;
  readonly status?: "conflict" | "error" | "success";
}

async function trustedContext() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("clinic onboarding context unavailable");
  }
  return {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
}

export async function attestClinicOnboardingAction(
  _state: ClinicOnboardingActionState,
  formData: FormData,
): Promise<ClinicOnboardingActionState> {
  const attestationCode = formData.get("attestationCode");
  const status = formData.get("status");
  const revision = formData.get("revision");
  const expiresAt = formData.get("expiresAt");
  if (
    typeof attestationCode !== "string" ||
    !CLINIC_ONBOARDING_ATTESTATION_CODES.includes(
      attestationCode as ClinicOnboardingAttestationCode,
    ) ||
    (status !== "attested" && status !== "withdrawn") ||
    typeof revision !== "string" ||
    !/^(?:0|[1-9][0-9]*)$/u.test(revision) ||
    typeof expiresAt !== "string"
  ) {
    return { message: "The readiness attestation is invalid.", status: "error" };
  }
  const parsedExpiry = expiresAt.length > 0 ? new Date(expiresAt) : undefined;
  if (parsedExpiry && (!Number.isFinite(parsedExpiry.getTime()) || parsedExpiry <= new Date())) {
    return { message: "Choose a future expiry date or leave it blank.", status: "error" };
  }
  const pool = createDatabasePool();
  try {
    const result = await attestClinicOnboarding(pool, {
      ...(await trustedContext()),
      attestationCode: attestationCode as ClinicOnboardingAttestationCode,
      expectedRevision: Number(revision),
      ...(parsedExpiry ? { expiresAt: parsedExpiry } : {}),
      status,
    });
    if (result === "conflict") {
      return {
        message: "Readiness changed elsewhere. Reload and review before retrying.",
        status: "conflict",
      };
    }
    revalidatePath("/clinic/onboarding");
    return { message: "Readiness attestation updated.", status: "success" };
  } catch {
    return { message: "Readiness could not be updated.", status: "error" };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
