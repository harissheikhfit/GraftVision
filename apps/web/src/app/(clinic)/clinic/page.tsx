import { redirect } from "next/navigation";

import {
  AuthBoundaryError,
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  hasVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  ActiveUserIndicator,
  Button,
  ClinicShell,
  PermissionDeniedState,
  PublicShell,
  SessionContextBar,
  SharedDeviceIndicator,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../session-activity-boundary";

import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

function LogoutForm() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}

export default async function ClinicShellPage() {
  const client = await createRequestAuthClient();
  let currentUser;
  let applicationSession;

  try {
    if (!(await hasVerifiedAuthSession(client, "clinic"))) {
      redirect("/login");
    }
    currentUser = await getCurrentUser(client);
    applicationSession = await getActiveApplicationSession();
    if (!applicationSession) {
      redirect("/locked");
    }
  } catch (error) {
    if (
      error instanceof AuthBoundaryError &&
      (error.code === "AUTH_SESSION_REQUIRED" || error.code === "AUTH_SESSION_EXPIRED")
    ) {
      redirect("/login");
    }

    return (
      <PublicShell action={<LogoutForm />} footer="No clinic data was loaded">
        <PermissionDeniedState description="This account cannot access the clinic workspace." />
      </PublicShell>
    );
  }

  return (
    <SessionActivityBoundary lastActivityAt={applicationSession.lastActivityAt.toISOString()}>
      <ClinicShell
        activeUser={
          <ActiveUserIndicator action={<LogoutForm />} value={currentUser.displayLabel} />
        }
        footer={<SharedDeviceIndicator description="No user or patient data is loaded." />}
        navigation={
          <ShellNavigation label="Clinic shell navigation">
            <ShellNavigationItem active href="/clinic" label="Current shell" />
            <ShellNavigationItem href="/clinic/patients" label="Patients" />
            <ShellNavigationItem href="/clinic/patients/register" label="Register patient" />
            <ShellNavigationItem href="/clinic" label="Reserved area" unavailable />
          </ShellNavigation>
        }
        sessionContext={<SessionContextBar state="temporary" />}
        toolbar={<ShellToolbar title={<h1>Clinic application shell</h1>} />}
      >
        <p>Authentication is active. Clinic selection and product workflows are not implemented.</p>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
