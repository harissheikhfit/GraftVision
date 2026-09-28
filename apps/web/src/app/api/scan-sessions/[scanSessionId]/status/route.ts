import { NextResponse, type NextRequest } from "next/server";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  readScanCaptureState,
  readScanPackageReadiness,
  readScanQualityMatrix,
} from "@graftvision/database";

export const dynamic = "force-dynamic";
const scanOrigin = "http://localhost:3001";

function response(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": scanOrigin,
      vary: "Origin",
    },
    status,
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-origin": scanOrigin,
      vary: "Origin",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly scanSessionId: string }> },
) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== scanOrigin)
      return response({ error: "SCAN_STATUS_DENIED" }, 403);
    const authClient = await createRequestAuthClient();
    await requireVerifiedAuthSession(authClient, "clinic");
    const [session, user, route] = await Promise.all([
      getActiveApplicationSession(),
      getCurrentUser(authClient),
      params,
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
      return NextResponse.json({ error: "SCAN_STATUS_DENIED" }, { status: 403 });
    }
    const pool = createDatabasePool();
    try {
      const result = await readScanCaptureState(pool, {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
      });
      const qualityContext = {
        applicationSessionId: session.id,
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
      };
      const [quality, readiness] = await Promise.all([
        readScanQualityMatrix(pool, qualityContext),
        readScanPackageReadiness(pool, qualityContext),
      ]);
      return result
        ? response(
            {
              capture: {
                captureStatus: result.capture.captureStatus,
                completedSteps: result.capture.completedSteps,
                currentStep: result.capture.currentStep,
                lastActivityAt: result.capture.lastActivityAt.toISOString(),
                revision: result.capture.revision,
              },
              expiresAt: result.expiresAt.toISOString(),
              quality: quality.map((row) => ({
                assetId: row.assetId,
                captureStep: row.captureStep,
                qualityRevision: row.qualityRevision,
                qualityState: row.qualityState,
                reasonCode: row.reasonCode,
                stale: row.stale,
              })),
              readiness: {
                blockerCodes: readiness.blockerCodes,
                isReady: readiness.isReady,
                qualityReviewRevision: readiness.qualityReviewRevision,
              },
              status: result.status,
            },
            200,
          )
        : response({ error: "SCAN_STATUS_DENIED" }, 404);
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return response({ error: "SCAN_STATUS_DENIED" }, 403);
  }
}
