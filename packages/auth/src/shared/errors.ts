export type AuthErrorCode =
  | "AUTH_APPLICATION_SCOPE_UNAVAILABLE"
  | "AUTH_CLINIC_ACCESS_UNAVAILABLE"
  | "AUTH_CONFIGURATION_INVALID"
  | "AUTH_IDENTITY_NOT_LINKED"
  | "AUTH_INTERNAL_USER_INACTIVE"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_INVITATION_FAILED"
  | "AUTH_LOGOUT_FAILED"
  | "AUTH_PERMISSION_DENIED"
  | "AUTH_RECOVERY_FAILED"
  | "AUTH_REAUTHENTICATION_FAILED"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_SESSION_REQUIRED";

export const authErrorMessages: Readonly<Record<AuthErrorCode, string>> = {
  AUTH_APPLICATION_SCOPE_UNAVAILABLE: "This account has no available application workspace.",
  AUTH_CLINIC_ACCESS_UNAVAILABLE: "This account cannot access the clinic workspace.",
  AUTH_CONFIGURATION_INVALID: "Authentication is temporarily unavailable.",
  AUTH_IDENTITY_NOT_LINKED: "This account cannot access the clinic workspace.",
  AUTH_INTERNAL_USER_INACTIVE: "This account cannot access the clinic workspace.",
  AUTH_INVALID_CREDENTIALS: "Unable to sign in with those credentials.",
  AUTH_INVITATION_FAILED: "Unable to send the invitation.",
  AUTH_LOGOUT_FAILED: "Unable to sign out safely. Please try again.",
  AUTH_PERMISSION_DENIED: "You do not have permission to perform this action.",
  AUTH_RECOVERY_FAILED: "Unable to send the recovery email.",
  AUTH_REAUTHENTICATION_FAILED: "Unable to unlock safely. Please sign in again.",
  AUTH_SESSION_EXPIRED: "Your session is no longer valid. Please sign in again.",
  AUTH_SESSION_REQUIRED: "Please sign in to continue.",
};

export class AuthBoundaryError extends Error {
  public readonly code: AuthErrorCode;

  public constructor(code: AuthErrorCode) {
    super(authErrorMessages[code]);
    this.code = code;
    this.name = "AuthBoundaryError";
  }
}
