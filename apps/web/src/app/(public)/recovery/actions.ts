"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@graftvision/auth";
import { authErrorMessages, createRequestAuthClient } from "@graftvision/auth/server";

export async function recoveryAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return {
      code: "AUTH_CONFIGURATION_INVALID",
      message: "Please enter a valid email address.",
    };
  }

  try {
    const client = await createRequestAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email);

    if (error) {
      return {
        code: "AUTH_RECOVERY_FAILED",
        message: authErrorMessages.AUTH_RECOVERY_FAILED,
      };
    }
  } catch {
    return {
      code: "AUTH_CONFIGURATION_INVALID",
      message: authErrorMessages.AUTH_CONFIGURATION_INVALID,
    };
  }

  redirect("/login?message=Check your email for a reset link");
}
