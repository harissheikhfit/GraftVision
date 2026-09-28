"use server";

import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getCurrentApplicationSessionState,
  reauthenticateAndUnlock,
  terminateLockedSession,
} from "@graftvision/auth/server";

export async function unlockAction(formData: FormData): Promise<never> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
    redirect("/login");
  }

  const client = await createRequestAuthClient();
  let destination: "/clinic" | "/platform";
  try {
    const session = await reauthenticateAndUnlock(client, password);
    destination = session.authorityScope === "platform" ? "/platform" : "/clinic";
  } catch {
    redirect("/login");
  }
  redirect(destination);
}

export async function logoutAfterLockAction(): Promise<never> {
  const client = await createRequestAuthClient();
  const state = await getCurrentApplicationSessionState();
  const { data } = await client.auth.getUser();

  if (state?.status === "locked" && data.user?.id === state.session.platformUserId) {
    await terminateLockedSession(data.user.id).catch(() => undefined);
  }
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/login");
}
