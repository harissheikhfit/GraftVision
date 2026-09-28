import type { AuthErrorCode } from "./errors";

export interface AuthActionState {
  readonly code?: AuthErrorCode;
  readonly message?: string;
}

export interface VerifiedProviderIdentity {
  readonly email: string;
  readonly id: string;
}

export interface AuthenticatedUser {
  readonly clinicId: string;
  readonly displayLabel: "Authenticated user";
  readonly platformUserId: string;
  readonly status: "active";
}

export interface LoginIdentity {
  readonly clinicId: string | null;
  readonly displayLabel: "Authenticated user";
  readonly hasPlatformOwnerAuthority: boolean;
  readonly platformUserId: string;
  readonly status: "active";
}

export type LoginAuthority =
  | {
      readonly authorityScope: "clinic";
      readonly clinicId: string;
      readonly destination: "/clinic";
    }
  | { readonly authorityScope: "platform"; readonly destination: "/platform" };
