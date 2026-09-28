export { AuthBoundaryError, authErrorMessages, type AuthErrorCode } from "./shared/errors";
export {
  normaliseLoginInput,
  validateRedirectTarget,
  type LoginInput,
  type LoginValidationResult,
} from "./shared/validation";
export type {
  AuthActionState,
  AuthenticatedUser,
  LoginAuthority,
  LoginIdentity,
  VerifiedProviderIdentity,
} from "./shared/types";
