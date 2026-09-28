import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
  uploadPrivateClinicalCaptureObject,
} from "@graftvision/auth/server";
import {
  assessScanTechnicalMetrics,
  authoriseScanCaptureUpload,
  createDatabasePool,
  isDuplicateScanCaptureChecksum,
  readScanPackageReadiness,
  registerScanCaptureAsset,
  saveScanQualityResult,
} from "@graftvision/database";
import type { ScanTechnicalImageMetrics } from "@graftvision/types";

const scanOrigin = "http://localhost:3001";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const steps = new Set([
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

function hasValidSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/png")
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return (
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  );
}

function readImageDimensions(
  bytes: Uint8Array,
  type: string,
): { height: number; width: number } | null {
  if (type === "image/png" && bytes.length >= 24)
    return {
      height: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20),
      width: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16),
    };
  if (type === "image/jpeg") {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1] ?? 0;
      const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xc3)
        return {
          height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
          width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
        };
      offset += length + 2;
    }
  }
  if (
    type === "image/webp" &&
    bytes.length >= 30 &&
    new TextDecoder().decode(bytes.subarray(12, 16)) === "VP8X"
  )
    return {
      height: 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16),
      width: 1 + (bytes[21] ?? 0) + ((bytes[22] ?? 0) << 8) + ((bytes[23] ?? 0) << 16),
    };
  return null;
}

function parseTechnicalMetrics(
  value: FormDataEntryValue | null,
  dimensions: { height: number; width: number } | null,
): ScanTechnicalImageMetrics | null {
  if (typeof value !== "string" || !dimensions) return null;
  try {
    const metrics = JSON.parse(value) as Omit<ScanTechnicalImageMetrics, "height" | "width"> & {
      readonly height: unknown;
      readonly width: unknown;
    };
    if (
      metrics.width !== dimensions.width ||
      metrics.height !== dimensions.height ||
      !Number.isFinite(metrics.blurVariance) ||
      !Number.isFinite(metrics.brightness) ||
      !Number.isFinite(metrics.framingCoverage) ||
      ![1, 3, 6, 8].includes(metrics.orientation)
    )
      return null;
    return {
      blurVariance: metrics.blurVariance,
      brightness: metrics.brightness,
      framingCoverage: metrics.framingCoverage,
      height: dimensions.height,
      orientation: metrics.orientation,
      width: dimensions.width,
    };
  } catch {
    return null;
  }
}

export function OPTIONS() {
  return response({}, 204);
}

export async function POST(
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly scanSessionId: string }> },
) {
  if (request.headers.get("origin") !== scanOrigin)
    return response({ error: "SCAN_MEDIA_DENIED" }, 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const step = form.get("step");
    const assetId = form.get("assetId");
    const idempotencyKey = form.get("idempotencyKey");
    const captureRevision = Number(form.get("captureRevision"));
    if (
      !(file instanceof File) ||
      typeof step !== "string" ||
      typeof assetId !== "string" ||
      typeof idempotencyKey !== "string" ||
      !uuid.test(assetId) ||
      !uuid.test(idempotencyKey) ||
      !steps.has(step) ||
      !allowedTypes.has(file.type) ||
      !Number.isInteger(captureRevision) ||
      file.size < 1 ||
      file.size > 10_485_760
    )
      return response({ error: "SCAN_MEDIA_INVALID" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, file.type)) return response({ error: "SCAN_MEDIA_INVALID" }, 400);
    const metrics = parseTechnicalMetrics(
      form.get("technicalMetrics"),
      readImageDimensions(bytes, file.type),
    );
    if (!metrics) return response({ error: "SCAN_MEDIA_INVALID" }, 400);

    const auth = await createRequestAuthClient();
    await requireVerifiedAuthSession(auth, "clinic");
    const [session, user, route] = await Promise.all([
      getActiveApplicationSession(),
      getCurrentUser(auth),
      params,
    ]);
    if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId)
      return response({ error: "SCAN_MEDIA_DENIED" }, 403);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const pool = createDatabasePool();
    try {
      const objectKey = await authoriseScanCaptureUpload(pool, {
        applicationSessionId: session.id,
        assetId,
        captureRevision,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
        step,
      });
      await uploadPrivateClinicalCaptureObject({
        bytes,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        objectKey,
      });
      const registered = await registerScanCaptureAsset(pool, {
        applicationSessionId: session.id,
        assetId,
        byteSize: file.size,
        captureRevision,
        checksum,
        idempotencyKey,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        objectKey,
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
        step,
      });
      const [duplicateChecksum, readiness] = await Promise.all([
        isDuplicateScanCaptureChecksum(pool, {
          applicationSessionId: session.id,
          assetId: registered.assetId,
          providerIdentityId: user.platformUserId,
          scanSessionId: route.scanSessionId,
        }),
        readScanPackageReadiness(pool, {
          applicationSessionId: session.id,
          providerIdentityId: user.platformUserId,
          scanSessionId: route.scanSessionId,
        }),
      ]);
      const assessment = await assessScanTechnicalMetrics(pool, {
        ...metrics,
        duplicateChecksum,
      });
      const quality = await saveScanQualityResult(pool, {
        applicationSessionId: session.id,
        assetId: registered.assetId,
        assetRevision: captureRevision,
        captureStep: step,
        expectedRevision: Math.max(1, readiness.qualityReviewRevision),
        idempotencyKey: registered.assetId,
        providerIdentityId: user.platformUserId,
        qualityState: assessment.qualityState,
        reasonCode: assessment.reasonCode,
        scanSessionId: route.scanSessionId,
        validatorVersion: "technical.v1",
      });
      return response(
        {
          assetId: registered.assetId,
          quality: { reasonCode: assessment.reasonCode, state: assessment.qualityState },
          qualityRevision: quality.revision,
          status: "uploaded",
        },
        200,
      );
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return response({ error: "SCAN_MEDIA_DENIED" }, 403);
  }
}
