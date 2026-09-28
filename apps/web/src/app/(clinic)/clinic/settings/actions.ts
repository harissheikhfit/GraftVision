"use server";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, updateClinicSettings } from "@graftvision/database";

export interface ClinicSettingsActionState {
  readonly fieldErrors?: {
    readonly displayName?: string;
    readonly timezone?: string;
  };
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
    throw new Error("clinic settings context unavailable");
  }
  return {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
}

export async function updateClinicSettingsAction(
  _state: ClinicSettingsActionState,
  formData: FormData,
): Promise<ClinicSettingsActionState> {
  const displayName = formData.get("displayName");
  const timezone = formData.get("timezone");
  const revision = formData.get("revision");
  if (typeof displayName !== "string" || displayName.trim().length < 1) {
    return { fieldErrors: { displayName: "Enter a clinic display name." }, status: "error" };
  }
  if (typeof timezone !== "string" || timezone.length < 1) {
    return { fieldErrors: { timezone: "Select a valid timezone." }, status: "error" };
  }
  if (typeof revision !== "string" || !/^[1-9][0-9]*$/u.test(revision)) {
    return { message: "Settings could not be updated.", status: "error" };
  }
  const pool = createDatabasePool();
  try {
    const result = await updateClinicSettings(pool, {
      ...(await trustedContext()),
      displayName,
      expectedRevision: Number(revision),
      timezone,
    });
    if (result === "conflict") {
      return {
        message: "These settings changed elsewhere. Reload the page and review before retrying.",
        status: "conflict",
      };
    }
    revalidatePath("/clinic/settings");
    return { message: "Clinic settings updated.", status: "success" };
  } catch {
    return { message: "Settings could not be updated.", status: "error" };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
