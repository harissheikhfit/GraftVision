export interface WorkspaceMarker<Name extends string> {
  readonly workspace: Name;
}

export type ScanTechnicalQualityState = "passed" | "retake_required" | "warning";

export interface ScanTechnicalImageMetrics {
  readonly blurVariance: number;
  readonly brightness: number;
  readonly framingCoverage: number;
  readonly height: number;
  readonly orientation: 1 | 3 | 6 | 8;
  readonly width: number;
}

export interface ScanTechnicalQualityAssessment {
  readonly reasonCode:
    | "HEAD_OUT_OF_FRAME"
    | "IMAGE_TOO_BLURRY"
    | "IMAGE_TOO_BRIGHT"
    | "IMAGE_TOO_DARK"
    | "IMAGE_TOO_SMALL"
    | "INVALID_ORIENTATION"
    | "SUBJECT_TOO_CLOSE"
    | "SUBJECT_TOO_FAR"
    | null;
  readonly state: ScanTechnicalQualityState;
}

/** Non-medical, deterministic capture checks. Results contain no image or patient data. */
export function assessScanTechnicalImage(
  metrics: ScanTechnicalImageMetrics,
): ScanTechnicalQualityAssessment {
  if (metrics.width < 1024 || metrics.height < 1024)
    return { state: "retake_required", reasonCode: "IMAGE_TOO_SMALL" };
  if (metrics.orientation !== 1)
    return { state: "retake_required", reasonCode: "INVALID_ORIENTATION" };
  if (metrics.blurVariance < 80)
    return { state: "retake_required", reasonCode: "IMAGE_TOO_BLURRY" };
  if (metrics.brightness < 45) return { state: "retake_required", reasonCode: "IMAGE_TOO_DARK" };
  if (metrics.brightness > 210) return { state: "retake_required", reasonCode: "IMAGE_TOO_BRIGHT" };
  if (metrics.framingCoverage < 0.08) return { state: "warning", reasonCode: "SUBJECT_TOO_FAR" };
  if (metrics.framingCoverage > 0.92) return { state: "warning", reasonCode: "SUBJECT_TOO_CLOSE" };
  return { state: "passed", reasonCode: null };
}
