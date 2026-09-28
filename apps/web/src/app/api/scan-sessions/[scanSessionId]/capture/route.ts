import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  recordScanCaptureStep,
  type ScanCaptureStep,
} from "@graftvision/database";

const scanOrigin = "http://localhost:3001";
const steps = new Set([
  "preparation",
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
  "review",
]);
const actions = new Set(["complete", "retake", "review"]);

function response(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-origin": scanOrigin,
      vary: "Origin",
    },
    status,
  });
}

export function OPTIONS() {
  return response({}, 204);
}

export async function POST(
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly scanSessionId: string }> },
) {
  if (request.headers.get("origin") !== scanOrigin)
    return response({ error: "SCAN_CAPTURE_DENIED" }, 403);
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      !("expectedRevision" in body) ||
      !("step" in body) ||
      typeof body.action !== "string" ||
      typeof body.step !== "string" ||
      typeof body.expectedRevision !== "number" ||
      !Number.isInteger(body.expectedRevision) ||
      !steps.has(body.step) ||
      !actions.has(body.action)
    )
      return response({ error: "SCAN_CAPTURE_DENIED" }, 400);
    const authClient = await createRequestAuthClient();
    await requireVerifiedAuthSession(authClient, "clinic");
    const [session, user, route] = await Promise.all([
      getActiveApplicationSession(),
      getCurrentUser(authClient),
      params,
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
      return response({ error: "SCAN_CAPTURE_DENIED" }, 403);
    const pool = createDatabasePool();
    try {
      const result = await recordScanCaptureStep(pool, {
        action: body.action as "complete" | "retake" | "review",
        applicationSessionId: session.id,
        expectedRevision: body.expectedRevision,
        idempotencyKey: randomUUID(),
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
        step: body.step as Exclude<ScanCaptureStep, "capture_complete">,
      });
      return response(
        {
          capture: {
            captureStatus: result.capture.captureStatus,
            completedSteps: result.capture.completedSteps,
            currentStep: result.capture.currentStep,
            lastActivityAt: result.capture.lastActivityAt.toISOString(),
            revision: result.capture.revision,
          },
          status: result.status,
        },
        200,
      );
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return response({ error: "SCAN_CAPTURE_DENIED" }, 403);
  }
}
