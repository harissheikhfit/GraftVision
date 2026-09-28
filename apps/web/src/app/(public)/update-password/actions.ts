"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@graftvision/auth";
import {
  authErrorMessages,
  createRequestAuthClient,
  establishApplicationSession,
  getDeviceContext,
  getLoginUser,
  selectLoginAuthority,
  signOutSafely,
} from "@graftvision/auth/server";

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: "/clinic" | "/platform";
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) {
    return {
      code: "AUTH_CONFIGURATION_INVALID",
      message: "Password must be at least 8 characters long.",
    };
  }

  try {
    const client = await createRequestAuthClient();
    const { error } = await client.auth.updateUser({ password });

    if (error) {
      return {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Failed to update password. Session might have expired.",
      };
    }

    try {
      const user = await getLoginUser(client);
      const authority = selectLoginAuthority(user);
      const device = await getDeviceContext();

      const session = await client.auth.getSession();
      const encodedClaims = session.data.session?.access_token.split(".")[1];
      const claims = encodedClaims
        ? (JSON.parse(Buffer.from(encodedClaims, "base64url").toString()) as {
            readonly session_id?: unknown;
          })
        : {};
      const providerSessionId =
        typeof claims.session_id === "string" ? claims.session_id : undefined;

      await establishApplicationSession({
        platformUserId: user.platformUserId,
        ...(authority.authorityScope === "platform"
          ? { authorityScope: "platform" as const }
          : { authorityScope: "clinic" as const, clinicId: authority.clinicId }),
        ...(providerSessionId === undefined ? {} : { providerSessionId }),
        deviceLabel: device.deviceLabel,
        userAgentHash: device.userAgentHash,
      });
      destination = authority.destination;
    } catch {
      await signOutSafely(client).catch(() => undefined);
      return {
        code: "AUTH_CLINIC_ACCESS_UNAVAILABLE",
        message: authErrorMessages.AUTH_CLINIC_ACCESS_UNAVAILABLE,
      };
    }
  } catch {
    return {
      code: "AUTH_CONFIGURATION_INVALID",
      message: authErrorMessages.AUTH_CONFIGURATION_INVALID,
    };
  }

  redirect(destination);
}
