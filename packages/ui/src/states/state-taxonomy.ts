export const operationalStates = [
  "draft",
  "pending",
  "in-progress",
  "completed",
  "failed",
  "expired",
  "revoked",
  "archived",
] as const;

export const approvalStates = [
  "review-required",
  "doctor-approved",
  "rejected",
  "amended",
  "superseded",
] as const;

export const privacyStates = [
  "internal",
  "doctor-only",
  "patient-safe",
  "temporary",
  "masked",
  "restricted",
] as const;

export const connectivityStates = [
  "online",
  "weak-connection",
  "offline",
  "saved-on-device",
  "waiting-to-upload",
  "uploading",
  "synced",
  "failed",
  "session-expired",
] as const;

export type OperationalState = (typeof operationalStates)[number];
export type ApprovalState = (typeof approvalStates)[number];
export type PrivacyState = (typeof privacyStates)[number];
export type ConnectivityState = (typeof connectivityStates)[number];
export type StateDensity = "comfortable" | "compact" | "presentation";
export type StateHeadingLevel = 1 | 2 | 3;
