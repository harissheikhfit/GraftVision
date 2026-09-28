"use server";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createClinic,
  createDatabasePool,
  managePlatformUserLifecycle,
  managePlatformClinicAdministrator,
  revokePlatformUserSessions,
  transitionClinicStatus,
  updatePlatformClinicMetadata,
} from "@graftvision/database";

async function authority() {
  const client = await createRequestAuthClient();
  await requireVerifiedAuthSession(client, "platform");
  const session = await getActiveApplicationSession();
  if (!session || session.authorityScope !== "platform")
    throw new Error("Platform context denied.");
  return {
    applicationSessionId: session.id,
    providerIdentityId: session.platformUserId,
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function platformClinicAction(formData: FormData): Promise<void> {
  const action = text(formData, "action");
  const pool = createDatabasePool();
  try {
    const trusted = await authority();
    if (action === "create") {
      await createClinic(pool, {
        ...trusted,
        clinicCode: text(formData, "clinicCode"),
        displayName: text(formData, "displayName"),
        initialStatus: "active",
        timezone: text(formData, "timezone"),
      });
    } else if (action === "metadata") {
      await updatePlatformClinicMetadata(pool, {
        ...trusted,
        clinicId: text(formData, "clinicId"),
        displayName: text(formData, "displayName"),
        expectedRevision: Number(formData.get("revision")),
        timezone: text(formData, "timezone"),
      });
    } else if (["suspend", "reactivate", "inactivate"].includes(action)) {
      if (action !== "reactivate" && text(formData, "confirmed") !== "yes")
        throw new Error("Explicit confirmation is required.");
      await transitionClinicStatus(pool, {
        ...trusted,
        clinicId: text(formData, "clinicId"),
        newStatus:
          action === "suspend" ? "suspended" : action === "reactivate" ? "active" : "inactive",
        reasonCode:
          action === "suspend"
            ? "OPERATIONAL_HOLD"
            : action === "reactivate"
              ? "OPERATIONAL_RESOLVED"
              : "PLATFORM_INACTIVATED",
      });
    } else if (["assign", "replace", "remove"].includes(action)) {
      if (["replace", "remove"].includes(action) && text(formData, "confirmed") !== "yes")
        throw new Error("Explicit confirmation is required.");
      await managePlatformClinicAdministrator(pool, {
        ...trusted,
        clinicId: text(formData, "clinicId"),
        operation: action as "assign" | "remove" | "replace",
        targetPlatformUserId: text(formData, "targetPlatformUserId"),
      });
    } else {
      throw new Error("Unsupported platform operation.");
    }
    revalidatePath("/platform");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function platformOperationalAction(formData: FormData): Promise<void> {
  if (text(formData, "confirmed") !== "yes") throw new Error("Explicit confirmation is required.");
  const action = text(formData, "action");
  const reasonCode = text(formData, "reasonCode");
  const pool = createDatabasePool();
  try {
    const trusted = await authority();
    if (action === "deactivate" || action === "reactivate") {
      await managePlatformUserLifecycle(pool, {
        ...trusted,
        expectedAuthorizationVersion: Number(formData.get("authorizationVersion")),
        operation: action,
        reasonCode: action === "reactivate" ? "ACCOUNT_RESTORED" : reasonCode,
        targetPlatformUserId: text(formData, "targetPlatformUserId"),
      });
    } else if (action === "revoke-one" || action === "revoke-all") {
      await revokePlatformUserSessions(pool, {
        ...trusted,
        reasonCode,
        revokeAll: action === "revoke-all",
        targetPlatformUserId: text(formData, "targetPlatformUserId"),
        ...(action === "revoke-one" ? { targetSessionId: text(formData, "targetSessionId") } : {}),
      });
    } else {
      throw new Error("Unsupported platform operational action.");
    }
    revalidatePath("/platform");
  } finally {
    await pool.end().catch(() => undefined);
  }
}
