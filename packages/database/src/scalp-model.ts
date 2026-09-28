import "server-only";
import { DatabaseBoundaryError, type TenantTransaction } from "./server";
export type ModelMode =
  "synthetic_mesh" | "sparse_point_cloud" | "dense_point_cloud" | "surface_mesh";
export const MODEL_PACKAGE_VERSION = "graftvision-model-package-v1" as const;
export const modelCapabilities: Record<ModelMode, Readonly<Record<string, boolean>>> = {
  synthetic_mesh: {
    viewer: true,
    points: true,
    curves: true,
    regions: true,
    approximateMeasurements: true,
    clinicalPlanning: false,
  },
  sparse_point_cloud: {
    viewer: true,
    points: true,
    curves: false,
    regions: false,
    approximateMeasurements: true,
    clinicalPlanning: false,
  },
  dense_point_cloud: {
    viewer: true,
    points: true,
    curves: false,
    regions: true,
    approximateMeasurements: true,
    clinicalPlanning: false,
  },
  surface_mesh: {
    viewer: true,
    points: true,
    curves: true,
    regions: true,
    approximateMeasurements: true,
    clinicalPlanning: false,
  },
};
export async function createModelPackage(
  t: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    outputManifestId: string;
    idempotencyKey: string;
  },
) {
  const r = await t.query<{ model_package_id: string; is_new: boolean }>(
    "select * from graftvision_private.create_scalp_model_package($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.outputManifestId,
      input.idempotencyKey,
    ],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Model package creation failed.");
  return { id: r.rows[0].model_package_id, isNew: r.rows[0].is_new };
}
export async function readModelPackage(
  t: TenantTransaction,
  input: { applicationSessionId: string; providerIdentityId: string; modelPackageId: string },
) {
  const r = await t.query<{ model_package_id: string; model_mode: ModelMode; artifact_id: string }>(
    "select * from graftvision_private.read_scalp_model_package($1::uuid,$2::uuid,$3::uuid)",
    [input.applicationSessionId, input.providerIdentityId, input.modelPackageId],
  );
  if (!r.rows[0]) throw new DatabaseBoundaryError("Model package is unavailable.");
  return r.rows[0];
}
