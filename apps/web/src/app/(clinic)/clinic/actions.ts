"use server";

import { redirect } from "next/navigation";

import { createRequestAuthClient, signOutSafely } from "@graftvision/auth/server";

export async function logoutAction(): Promise<never> {
  try {
    const client = await createRequestAuthClient();
    await signOutSafely(client);
  } catch {
    // Repeated logout and invalid sessions still return to the public boundary.
  }

  redirect("/login");
}
