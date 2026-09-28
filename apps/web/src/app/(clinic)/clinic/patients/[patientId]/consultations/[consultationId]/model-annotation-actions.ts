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
  readModelAnnotations,
  saveModelLandmark,
  supersedeModelLandmark,
  saveModelCurve,
  supersedeModelCurve,
  saveModelRegion,
  supersedeModelRegion,
  finalizeModelAnnotations,
  createSupersedingModelAnnotationDraft,
  readModelAnnotationHistory,
  type CurveControlPoint,
  type LandmarkCode,
  type CurveCode,
  type RegionCode,
  type SmoothingMode,
  type ModelAnnotationPackage,
  type ModelAnnotationEventValue,
} from "@graftvision/database";

export interface ModelAnnotationActionContext {
  readonly consultationId: string;
  readonly patientId: string;
}

export interface ModelAnnotationActionState {
  readonly message?: string;
  readonly status?: "conflict" | "denied" | "error" | "success";
  readonly packageRevision?: number;
  readonly pointerRevision?: number;
  readonly versionId?: string;
}

async function context() {
  const auth = await createRequestAuthClient();
  await requireVerifiedAuthSession(auth, "clinic");
  const [session, user] = await Promise.all([getActiveApplicationSession(), getCurrentUser(auth)]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
    throw new Error("MODEL_ANNOTATION_DENIED");
  return { session, user };
}

function state(error: unknown): ModelAnnotationActionState {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CONFLICT"))
    return {
      message: "The model was updated by someone else. Please refresh.",
      status: "conflict",
    };
  if (message.includes("DENIED"))
    return { message: "This action is not available.", status: "denied" };
  return { message: "Unable to update annotation.", status: "error" };
}

export async function readModelAnnotationsAction(
  _route: ModelAnnotationActionContext,
  annotationPackageId: string,
): Promise<ModelAnnotationPackage | null> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    try {
      return await readModelAnnotations(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId,
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

export async function saveModelLandmarkAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      const surfaceReference = formData.get("surfaceReference");
      result = await saveModelLandmark(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        landmarkCode: formData.get("landmarkCode") as string as LandmarkCode,
        x: Number(formData.get("x")),
        y: Number(formData.get("y")),
        z: Number(formData.get("z")),
        surfaceReference:
          typeof surfaceReference === "string" && surfaceReference !== "" ? surfaceReference : null,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Landmark saved.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.landmark_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function supersedeModelLandmarkAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      result = await supersedeModelLandmark(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        landmarkCode: formData.get("landmarkCode") as string as LandmarkCode,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Landmark removed.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.tombstone_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function saveModelCurveAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      const pointsData = formData.get("points") as string;
      const points = JSON.parse(pointsData) as CurveControlPoint[];
      result = await saveModelCurve(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        curveCode: formData.get("curveCode") as string as CurveCode,
        points,
        closed: formData.get("closed") === "true",
        smoothingMode: formData.get("smoothingMode") as string as SmoothingMode,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Curve saved.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.curve_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function supersedeModelCurveAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      result = await supersedeModelCurve(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        curveCode: formData.get("curveCode") as string as CurveCode,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Curve removed.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.tombstone_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function saveModelRegionAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      const pointsData = formData.get("points") as string;
      const points = JSON.parse(pointsData) as CurveControlPoint[];
      result = await saveModelRegion(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        regionCode: formData.get("regionCode") as string as RegionCode,
        points,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Region saved.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.region_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function supersedeModelRegionAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      result = await supersedeModelRegion(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        regionCode: formData.get("regionCode") as string as RegionCode,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        expectedPointerRevision: Number(formData.get("expectedPointerRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Region removed.",
      status: "success",
      packageRevision: result.package_revision,
      pointerRevision: result.pointer_revision,
      versionId: result.tombstone_version_id,
    };
  } catch (error) {
    return state(error);
  }
}

export async function finalizeModelAnnotationsAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      result = await finalizeModelAnnotations(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Model annotations finalized.",
      status: "success",
      packageRevision: result.revision,
    };
  } catch (error) {
    return state(error);
  }
}

export async function createSupersedingModelAnnotationDraftAction(
  route: ModelAnnotationActionContext,
  _previous: ModelAnnotationActionState,
  formData: FormData,
): Promise<ModelAnnotationActionState> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    let result;
    try {
      result = await createSupersedingModelAnnotationDraft(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId: formData.get("annotationPackageId") as string,
        expectedPackageRevision: Number(formData.get("expectedPackageRevision")),
        idempotencyKey: (formData.get("idempotencyKey") as string) || randomUUID(),
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
    revalidatePath(`/clinic/patients/${route.patientId}/consultations/${route.consultationId}`);
    return {
      message: "Created new draft.",
      status: "success",
      packageRevision: result.revision,
    };
  } catch (error) {
    return state(error);
  }
}

export async function readModelAnnotationHistoryAction(
  _route: ModelAnnotationActionContext,
  annotationPackageId: string,
): Promise<ModelAnnotationEventValue[]> {
  try {
    const { session, user } = await context();
    const pool = createDatabasePool();
    try {
      return await readModelAnnotationHistory(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        annotationPackageId,
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return [];
  }
}
