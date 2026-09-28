import { NextResponse, type NextRequest } from "next/server";

import {
  createPrivateClinicalCaptureUrl,
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, readScanCapturePreview } from "@graftvision/database";

export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { readonly params: Promise<{ readonly scanSessionId: string; readonly assetId: string }> },
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
      return NextResponse.json({ error: "SCAN_PREVIEW_DENIED" }, { status: 403 });
    const pool = createDatabasePool();
    try {
      const preview = await readScanCapturePreview(pool, {
        applicationSessionId: session.id,
        assetId: route.assetId,
        providerIdentityId: user.platformUserId,
        scanSessionId: route.scanSessionId,
      });
      if (!preview) return NextResponse.json({ error: "SCAN_PREVIEW_DENIED" }, { status: 403 });
      const url = await createPrivateClinicalCaptureUrl(preview.objectKey);
      return NextResponse.json({ url }, { headers: { "cache-control": "private, no-store" } });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch {
    return NextResponse.json({ error: "SCAN_PREVIEW_DENIED" }, { status: 403 });
  }
}
