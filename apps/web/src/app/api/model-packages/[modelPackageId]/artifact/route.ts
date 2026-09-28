import { NextResponse, type NextRequest } from "next/server";

import {
  createPrivateReconstructionArtifactUrl,
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  readModelPackage,
  withLocalTenantContext,
} from "@graftvision/database";
export const dynamic = "force-dynamic";
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ modelPackageId: string }> },
) {
  try {
    const auth = await createRequestAuthClient();
    await requireVerifiedAuthSession(auth, "clinic");
    const [session, user, route] = await Promise.all([
      getActiveApplicationSession(),
      getCurrentUser(auth),
      params,
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
      return NextResponse.json(
        { error: "MODEL_ACCESS_DENIED" },
        { status: 403, headers: { "cache-control": "private, no-store" } },
      );
    const pool = createDatabasePool();
    try {
      const model = await withLocalTenantContext(
        pool,
        { clinicId: session.clinicId, platformUserId: user.platformUserId },
        (t) =>
          readModelPackage(t, {
            applicationSessionId: session.id,
            providerIdentityId: user.platformUserId,
            modelPackageId: route.modelPackageId,
          }),
      );
      const extension =
        model.model_mode === "sparse_point_cloud" || model.model_mode === "dense_point_cloud"
          ? "cloud.ply"
          : model.model_mode === "surface_mesh"
            ? "mesh.glb"
            : "model.glb";
      const url = await createPrivateReconstructionArtifactUrl(
        `reconstruction/artifacts/${model.artifact_id}/${extension}`,
      );
      return NextResponse.json({ url }, { headers: { "cache-control": "private, no-store" } });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return NextResponse.json(
      { error: "MODEL_ACCESS_DENIED" },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }
}
