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
  savePreliminaryAssessment,
  transitionPreliminaryAssessmentReview,
  type PreliminaryAssessmentReviewState,
} from "@graftvision/database";

export interface PreliminaryAssessmentActionState {
  readonly message?: string;
  readonly status?: "conflict" | "error" | "success";
}
export interface PreliminaryAssessmentActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

const text = (form: FormData, name: string): string => (form.get(name) as string) || "".trim();
const optionalText = (form: FormData, name: string): string | undefined =>
  text(form, name) || undefined;
const number = (form: FormData, name: string): number => Number.parseInt(text(form, name), 10);
const nullableText = (form: FormData, name: string): string | null =>
  optionalText(form, name) ?? null;

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

export async function savePreliminaryAssessmentAction(
  context: PreliminaryAssessmentActionContext,
  _state: PreliminaryAssessmentActionState,
  form: FormData,
): Promise<PreliminaryAssessmentActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      savePreliminaryAssessment(pool, applicationSessionId, providerIdentityId, {
        consultationId: context.consultationId,
        expectedRevision: number(form, "expectedRevision"),
        idempotencyKey: text(form, "idempotencyKey"),
        patientMedicalHistoryVersionId: text(form, "patientMedicalHistoryVersionId"),
        consultationHairLossHistoryVersionId: text(form, "consultationHairLossHistoryVersionId"),
        consultationRevision: number(form, "consultationRevision"),
        patternClassification: nullableText(form, "patternClassification"),
        certaintyCode: nullableText(form, "certaintyCode"),
        sourceCode: nullableText(form, "sourceCode"),
        limitedClarification: nullableText(form, "limitedClarification"),
        frontalInvolvementStatus: nullableText(form, "frontalInvolvementStatus"),
        temporalInvolvementStatus: nullableText(form, "temporalInvolvementStatus"),
        midScalpInvolvementStatus: nullableText(form, "midScalpInvolvementStatus"),
        crownInvolvementStatus: nullableText(form, "crownInvolvementStatus"),
        diffuseInvolvementStatus: nullableText(form, "diffuseInvolvementStatus"),
        recipientObservationSummary: nullableText(form, "recipientObservationSummary"),
        donorAreaConcernStatus: nullableText(form, "donorAreaConcernStatus"),
        donorLimitationStatus: nullableText(form, "donorLimitationStatus"),
        previousDonorProcedureEvidenceStatus: nullableText(
          form,
          "previousDonorProcedureEvidenceStatus",
        ),
        donorObservationSummary: nullableText(form, "donorObservationSummary"),
        activeScalpSymptomConcern: nullableText(form, "activeScalpSymptomConcern"),
        visibleScalpConditionConcern: nullableText(form, "visibleScalpConditionConcern"),
        unresolvedMedicalWarningStatus: nullableText(form, "unresolvedMedicalWarningStatus"),
        additionalInformationRequiredStatus: nullableText(
          form,
          "additionalInformationRequiredStatus",
        ),
        warningCodes: form.getAll("warningCodes").map(String),
        safetyObservationSummary: nullableText(form, "safetyObservationSummary"),
      }),
    );
    if (result.outcome === "stale-revision") {
      return { message: "Reload the latest preliminary assessment version.", status: "conflict" };
    }
    revalidatePath(`/clinic/patients/${context.patientId}/consultations/${context.consultationId}`);
    return { message: "Preliminary assessment saved.", status: "success" };
  } catch {
    return { message: "Preliminary assessment could not be saved safely.", status: "error" };
  }
}

export async function transitionPreliminaryAssessmentReviewAction(
  context: PreliminaryAssessmentActionContext,
  _state: PreliminaryAssessmentActionState,
  form: FormData,
): Promise<PreliminaryAssessmentActionState> {
  try {
    const result = await withClinicalContext(({ applicationSessionId, pool, providerIdentityId }) =>
      transitionPreliminaryAssessmentReview(
        pool,
        applicationSessionId,
        providerIdentityId,
        context.consultationId,
        number(form, "expectedRevision"),
        text(form, "idempotencyKey"),
        text(form, "newState") as PreliminaryAssessmentReviewState,
        nullableText(form, "controlledReason"),
      ),
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
