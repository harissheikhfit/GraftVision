export type ShellVariant = "clinic" | "platform" | "presentation" | "public" | "scan";
export type ShellContentWidth = "full" | "narrow" | "presentation" | "standard" | "wide";
export type ResponsiveShellVisibility = "always" | "desktop" | "mobile" | "presentation";
export type PrivacyContextLevel =
  "internal-workspace" | "patient-safe" | "presentation-mode" | "restricted" | "temporary-access";
export type SessionContextState =
  "active" | "expired" | "expiring" | "offline" | "revoked" | "temporary" | "unsynced";
export type ShellLockMode = "presentation" | "revoked-session" | "shared-device";
