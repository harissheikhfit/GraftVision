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
  mutateDoctorPrivateNote,
  saveHairLossHistory,
  saveMedicalHistory,
  transitionClinicalHistoryReview,
} from "@graftvision/database";

export interface ClinicalActionState {
  readonly message?: string;
  readonly status?: "conflict" | "error" | "success";
}
export interface ClinicalActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

const text = (form: FormData, name: string): string => (form.get(name) as string) || "".trim();
const optionalText = (form: FormData, name: string): string | undefined =>
  text(form, name) || undefined;
const number = (form: FormData, name: string): number => Number.parseInt(text(form, name), 10);

async function withClinicalContext<Result>(
  operation: (context: {
    applicationSessionId: string;
    pool: ReturnType<typeof createDatabasePool>;
    providerIdentityId: string;
  }) => Promise<Result>,
): Promise<Result> {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("Clinical context is unavailable.");
  }
  const pool = createDatabasePool();
  try {
    return await operation({
      applicationSessionId: session.id,
      pool,
      providerIdentityId: user.platformUserId,
    });
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function saveMedicalHistoryAction(
  context: ClinicalActionContext,
  _state: ClinicalActionState,
  form: FormData,
): Promise<ClinicalActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      saveMedicalHistory(pool, {
        allergyStatus: text(form, "allergyStatus") as never,
        allergySubstance: optionalText(form, "allergySubstance"),
        anaesthesiaIssueStatus: text(form, "anaesthesiaIssueStatus") as never,
        applicationSessionId,
        bleedingConcernStatus: text(form, "bleedingConcernStatus") as never,
        certaintyCode: text(form, "certaintyCode") as never,
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        healingConcernStatus: text(form, "healingConcernStatus") as never,
        idempotencyKey: text(form, "idempotencyKey"),
        medicalConditionClarification: optionalText(form, "medicalConditionClarification"),
        medicalConditionStatus: text(form, "medicalConditionStatus") as never,
        medicationName: optionalText(form, "medicationName"),
        medicationStatus: text(form, "medicationStatus") as never,
        previousOperationStatus: text(form, "previousOperationStatus") as never,
        providerIdentityId,
        sectionSummary: optionalText(form, "sectionSummary"),
        sourceCode: text(form, "sourceCode") as never,
        warningCodes: form.getAll("warningCodes").map(String),
      }),
    );
    if (result.outcome === "stale-revision") {
      return { message: "Reload the latest medical-history version.", status: "conflict" };
    }
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "Medical-history version saved.", status: "success" };
  } catch {
    return { message: "Medical history could not be saved safely.", status: "error" };
  }
}

export async function saveHairLossHistoryAction(
  context: ClinicalActionContext,
  _state: ClinicalActionState,
  form: FormData,
): Promise<ClinicalActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      saveHairLossHistory(pool, {
        applicationSessionId,
        certaintyCode: text(form, "certaintyCode") as never,
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
        onsetKind: text(form, "onsetKind") as never,
        onsetValue: optionalText(form, "onsetValue") ? number(form, "onsetValue") : undefined,
        patientGoalCodes: form.getAll("patientGoalCodes").map(String),
        patternClassification: text(form, "patternClassification") as never,
        previousHairProcedureStatus: text(form, "previousHairProcedureStatus") as never,
        primaryConcern: text(form, "primaryConcern") as never,
        progression: text(form, "progression") as never,
        providerIdentityId,
        scalpSymptomCodes: form.getAll("scalpSymptomCodes").map(String),
        scalpSymptomStatus: text(form, "scalpSymptomStatus") as never,
        sectionClarification: optionalText(form, "sectionClarification"),
        sourceCode: text(form, "sourceCode") as never,
      }),
    );
    if (result.outcome === "stale-revision") {
      return { message: "Reload the latest hair-loss-history version.", status: "conflict" };
    }
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "Hair-loss-history version saved.", status: "success" };
  } catch {
    return { message: "Hair-loss history could not be saved safely.", status: "error" };
  }
}

export async function transitionClinicalReviewAction(
  context: ClinicalActionContext,
  _state: ClinicalActionState,
  form: FormData,
): Promise<ClinicalActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      transitionClinicalHistoryReview(pool, {
        aggregateType: text(form, "aggregateType") as never,
        applicationSessionId,
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
        newState: text(form, "newState") as never,
        providerIdentityId,
        reasonCode: text(form, "reasonCode"),
      }),
    );
    if (result.outcome === "stale-revision") {
      return { message: "Reload before changing the review state.", status: "conflict" };
    }
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "Review state updated.", status: "success" };
  } catch {
    return { message: "The review state could not be changed.", status: "error" };
  }
}

export async function createPrivateNoteAction(
  context: ClinicalActionContext,
  _state: ClinicalActionState,
  form: FormData,
): Promise<ClinicalActionState> {
  try {
    await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      mutateDoctorPrivateNote(pool, {
        action: text(form, "action") as "amend" | "create" | "retract",
        applicationSessionId,
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
        noteId: optionalText(form, "noteId"),
        noteText: optionalText(form, "noteText"),
        providerIdentityId,
        reasonCode: optionalText(form, "reasonCode"),
      }),
    );
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "Private note updated.", status: "success" };
  } catch {
    return { message: "Private note access was denied or the note was invalid.", status: "error" };
  }
}
