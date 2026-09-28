"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  removePrivateClinicBrandingObject,
  requireVerifiedAuthSession,
  uploadPrivateClinicBrandingObject,
} from "@graftvision/auth/server";
import {
  CLINIC_BRANDING_MAX_BYTES,
  createClinicLogoObjectKey,
  createDatabasePool,
  readClinicBranding,
  updateClinicBranding,
  validateClinicLogo,
} from "@graftvision/database";

export interface ClinicBrandingActionState {
  readonly fieldErrors?: Readonly<Record<string, string>>;
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
    throw new Error("clinic branding context unavailable");
  }
  return {
    applicationSessionId: session.id,
    clinicId: session.clinicId,
    providerIdentityId: user.platformUserId,
  };
}

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export async function updateClinicBrandingAction(
  _state: ClinicBrandingActionState,
  formData: FormData,
): Promise<ClinicBrandingActionState> {
  const fields = {
    clinicName: text(formData, "clinicName"),
    linkAccent: text(formData, "linkAccent"),
    presentationTitleText: text(formData, "presentationTitleText"),
    primaryAccent: text(formData, "primaryAccent"),
    reportHeaderText: text(formData, "reportHeaderText"),
    secondaryAccent: text(formData, "secondaryAccent"),
    selectedControlAccent: text(formData, "selectedControlAccent"),
  };
  const revision = text(formData, "brandingRevision");
  const removeLogo = text(formData, "removeLogo") === "on";
  const logoValue = formData.get("logo");
  const logo = logoValue instanceof File && logoValue.size > 0 ? logoValue : null;
  const fieldErrors: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!value) fieldErrors[name] = "This field is required.";
  }
  if (!revision || !/^[1-9][0-9]*$/u.test(revision)) {
    return { message: "Branding could not be updated.", status: "error" };
  }
  if (logo && logo.size > CLINIC_BRANDING_MAX_BYTES) {
    fieldErrors.logo = "Choose a logo no larger than 2 MB.";
  }
  if (logo && removeLogo) fieldErrors.logo = "Choose either a replacement or removal.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, status: "error" };
  const {
    clinicName,
    linkAccent,
    presentationTitleText,
    primaryAccent,
    reportHeaderText,
    secondaryAccent,
    selectedControlAccent,
  } = fields;
  if (
    !clinicName ||
    !linkAccent ||
    !presentationTitleText ||
    !primaryAccent ||
    !reportHeaderText ||
    !secondaryAccent ||
    !selectedControlAccent
  ) {
    return { message: "Branding could not be updated.", status: "error" };
  }

  const pool = createDatabasePool();
  let uploadedObjectKey: string | null = null;
  try {
    const context = await trustedContext();
    const current = await readClinicBranding(pool, context);
    let validatedLogo: ReturnType<typeof validateClinicLogo> | null = null;
    if (logo) {
      validatedLogo = validateClinicLogo(new Uint8Array(await logo.arrayBuffer()), logo.type);
      uploadedObjectKey = createClinicLogoObjectKey({
        assetId: randomUUID(),
        clinicId: context.clinicId,
        extension: validatedLogo.extension,
        version: current.brandingRevision + 1,
      });
      await uploadPrivateClinicBrandingObject({
        bytes: validatedLogo.bytes,
        contentType: validatedLogo.mimeType,
        objectKey: uploadedObjectKey,
      });
    }
    const result = await updateClinicBranding(pool, {
      applicationSessionId: context.applicationSessionId,
      clinicName,
      expectedRevision: Number(revision),
      linkAccent,
      ...(validatedLogo && uploadedObjectKey
        ? {
            logo: {
              height: validatedLogo.height,
              mimeType: validatedLogo.mimeType,
              objectKey: uploadedObjectKey,
              width: validatedLogo.width,
            },
          }
        : {}),
      logoMode: validatedLogo ? "replace" : removeLogo ? "remove" : "keep",
      presentationTitleText,
      primaryAccent,
      providerIdentityId: context.providerIdentityId,
      reportHeaderText,
      secondaryAccent,
      selectedControlAccent,
    });
    if (result === "conflict") {
      if (uploadedObjectKey) await removePrivateClinicBrandingObject(uploadedObjectKey);
      return {
        message: "Branding changed elsewhere. Reload and review before retrying.",
        status: "conflict",
      };
    }
    if (
      result === "updated" &&
      current.logoObjectKey &&
      (removeLogo || uploadedObjectKey !== null)
    ) {
      await removePrivateClinicBrandingObject(current.logoObjectKey).catch(() => undefined);
    }
    revalidatePath("/clinic/settings/branding");
    return { message: "Clinic branding updated.", status: "success" };
  } catch {
    if (uploadedObjectKey) {
      await removePrivateClinicBrandingObject(uploadedObjectKey).catch(() => undefined);
    }
    return {
      message: "Branding could not be updated. Check the fields and logo, then retry.",
      status: "error",
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
