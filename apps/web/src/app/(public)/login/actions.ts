"use server";

import { redirect } from "next/navigation";

import { normaliseLoginInput } from "@graftvision/auth";
import type { AuthActionState } from "@graftvision/auth";
import {
  authErrorMessages,
  AuthBoundaryError,
  createRequestAuthClient,
  establishApplicationSession,
  getDeviceContext,
  getLoginUser,
  selectLoginAuthority,
  signOutSafely,
} from "@graftvision/auth/server";

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: "/clinic" | "/platform";
  const validation = normaliseLoginInput(formData.get("email"), formData.get("password"));

  if (!validation.valid) {
    return {
      code: "AUTH_INVALID_CREDENTIALS",
      message: authErrorMessages.AUTH_INVALID_CREDENTIALS,
    };
  }

  try {
    const client = await createRequestAuthClient();
    const { error } = await client.auth.signInWithPassword(validation.input);

    if (error) {
      return {
        code: "AUTH_INVALID_CREDENTIALS",
        message: authErrorMessages.AUTH_INVALID_CREDENTIALS,
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
    } catch (error) {
      await signOutSafely(client).catch(() => undefined);
      const code =
        error instanceof AuthBoundaryError ? error.code : "AUTH_APPLICATION_SCOPE_UNAVAILABLE";
      return {
        code,
        message: authErrorMessages[code],
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
