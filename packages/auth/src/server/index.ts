import "server-only";

export { createAuthAdminClient } from "./admin";
export { createAuthServerClient, createRequestAuthClient } from "./client";
export {
  getCurrentUser,
  getLoginUser,
  resolveCurrentUser,
  resolveLoginUser,
  selectLoginAuthority,
  type IdentityResolver,
  type LoginIdentityResolver,
} from "./current-user";
export { inviteUserByEmail } from "./invite";
export { signOutSafely } from "./logout";
export { createPrivateReconstructionArtifactUrl } from "./private-storage";
export {
  createSupabaseMfaCapabilityProvider,
  type MfaCapabilityProvider,
  type MfaReadinessStatus,
} from "./mfa";
export { refreshAuthSession } from "./proxy";
export {
  createPrivateClinicBrandingUrl,
  createPrivateClinicalCaptureUrl,
  removePrivateClinicBrandingObject,
  uploadPrivateClinicBrandingObject,
  uploadPrivateClinicalCaptureObject,
} from "./private-storage";
export { sendPasswordRecoveryEmail } from "./recover";
export { hasVerifiedAuthSession, requireVerifiedAuthSession } from "./session";
export { reauthenticateAndUnlock } from "./reauthentication";
export { evaluatePermission, requirePermission } from "./rbac";
export { AuthBoundaryError, authErrorMessages, type AuthErrorCode } from "../shared/errors";
export type {
  AuthActionState,
  AuthenticatedUser,
  LoginAuthority,
  LoginIdentity,
  VerifiedProviderIdentity,
} from "../shared/types";
export type { EmailOtpType } from "@supabase/supabase-js";
export {
  establishApplicationSession,
  getActiveApplicationSession,
  getCurrentApplicationSessionState,
  lockCurrentApplicationSession,
  recordSuccessfulApplicationActivity,
  switchApplicationSessionAuthority,
  terminateCurrentSession,
  terminateOtherSession,
  terminateAllOtherSessions,
  terminateLockedSession,
  unlockCurrentApplicationSession,
} from "./registry";
export { getDeviceContext } from "./device";
