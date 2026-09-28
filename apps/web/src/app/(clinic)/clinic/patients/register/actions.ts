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
  type MaskedDuplicatePatient,
  type PatientDuplicateOverrideReason,
  PATIENT_DUPLICATE_OVERRIDE_REASONS,
  registerPatient,
  validatePatientRegistration,
} from "@graftvision/database";

export interface PatientRegistrationActionState {
  readonly duplicates?: readonly MaskedDuplicatePatient[];
  readonly fieldErrors?: {
    readonly dateOfBirth?: string;
    readonly email?: string;
    readonly fullName?: string;
    readonly phone?: string;
  };
  readonly idempotencyKey?: string;
  readonly message?: string;
  readonly patientNumber?: string;
  readonly status?: "duplicate_warning" | "error" | "success";
  readonly values?: {
    readonly dateOfBirth: string;
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
  };
}

async function trustedContext() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("patient registration context unavailable");
  }
  return {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
}

export async function registerPatientAction(
  state: PatientRegistrationActionState,
  formData: FormData,
): Promise<PatientRegistrationActionState> {
  const fullName = formData.get("fullName");
  const dateOfBirth = formData.get("dateOfBirth");
  const phone = formData.get("phone");
  const email = formData.get("email");
  const idempotencyKey = formData.get("idempotencyKey");
  const overrideReasonCode = formData.get("overrideReasonCode");
  const confirmOverride = formData.get("confirmOverride");
  if (
    typeof fullName !== "string" ||
    typeof dateOfBirth !== "string" ||
    typeof phone !== "string" ||
    typeof email !== "string" ||
    typeof idempotencyKey !== "string"
  ) {
    return { message: "Registration could not be submitted.", status: "error" };
  }
  const values = { dateOfBirth, email, fullName, phone };
  const fieldErrors: {
    dateOfBirth?: string;
    email?: string;
    fullName?: string;
    phone?: string;
  } = {};
  try {
    validatePatientRegistration({ dateOfBirth, email, fullName, phone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("fullName")) fieldErrors.fullName = "Enter the patient’s full name.";
    if (message.includes("dateOfBirth")) fieldErrors.dateOfBirth = "Enter a valid date of birth.";
    if (message.includes("phone")) fieldErrors.phone = "Enter a valid international phone number.";
    if (message.includes("email"))
      fieldErrors.email = "Enter a valid email address or leave blank.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, idempotencyKey, status: "error", values };
  }
  let approvedOverride: PatientDuplicateOverrideReason | undefined;
  if (state.status === "duplicate_warning") {
    if (
      confirmOverride !== "yes" ||
      typeof overrideReasonCode !== "string" ||
      !PATIENT_DUPLICATE_OVERRIDE_REASONS.includes(
        overrideReasonCode as PatientDuplicateOverrideReason,
      )
    ) {
      return {
        ...state,
        idempotencyKey,
        message: "Confirm the distinct patient and select an approved reason.",
        values,
      };
    }
    approvedOverride = overrideReasonCode as PatientDuplicateOverrideReason;
  }
  const pool = createDatabasePool();
  try {
    const result = await registerPatient(pool, {
      ...(await trustedContext()),
      dateOfBirth,
      ...(email.trim() ? { email } : {}),
      fullName,
      idempotencyKey,
      ...(approvedOverride ? { overrideReasonCode: approvedOverride } : {}),
      phone,
    });
    if (result.outcome === "duplicate_warning") {
      return {
        duplicates: result.duplicates,
        idempotencyKey,
        message: "Possible same-clinic matches found. Review the masked details before continuing.",
        status: "duplicate_warning",
        values,
      };
    }
    revalidatePath("/clinic/patients/register");
    return {
      idempotencyKey,
      message: "Patient registration created.",
      patientNumber: result.patient.patientNumber,
      status: "success",
    };
  } catch {
    return {
      idempotencyKey,
      message: "Patient registration could not be completed.",
      status: "error",
      values,
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
