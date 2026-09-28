const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const allowedRedirects = new Set(["/clinic"]);

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export type LoginValidationResult =
  { readonly input: LoginInput; readonly valid: true } | { readonly valid: false };

export function normaliseLoginInput(
  emailValue: unknown,
  passwordValue: unknown,
): LoginValidationResult {
  if (typeof emailValue !== "string" || typeof passwordValue !== "string") {
    return { valid: false };
  }

  const email = emailValue.trim().toLowerCase();

  if (
    !emailPattern.test(email) ||
    email.length > 254 ||
    passwordValue.length < 8 ||
    passwordValue.length > 1024
  ) {
    return { valid: false };
  }

  return { input: { email, password: passwordValue }, valid: true };
}

export function validateRedirectTarget(value: string | null | undefined): "/clinic" {
  return value && allowedRedirects.has(value) ? "/clinic" : "/clinic";
}
