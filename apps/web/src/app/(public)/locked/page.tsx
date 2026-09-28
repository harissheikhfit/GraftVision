import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getCurrentApplicationSessionState,
} from "@graftvision/auth/server";

import { logoutAfterLockAction, unlockAction } from "./actions";
import { LockedSessionContent } from "./locked-session-content";

export const dynamic = "force-dynamic";

export default async function LockedPage() {
  const client = await createRequestAuthClient();
  const state = await getCurrentApplicationSessionState();
  const { data } = await client.auth.getUser();

  if (state?.status !== "locked" || !data.user || data.user.id !== state.session.platformUserId) {
    redirect("/login");
  }

  return <LockedSessionContent logoutAction={logoutAfterLockAction} unlockAction={unlockAction} />;
}
