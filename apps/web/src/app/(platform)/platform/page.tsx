import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  requireVerifiedAuthSession,
  signOutSafely,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  readPlatformAudit,
  readPlatformDashboard,
  readPlatformSessionHealth,
} from "@graftvision/database";
import {
  ActiveUserIndicator,
  Button,
  Inline,
  PlatformShell,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  StatusBadge,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../session-activity-boundary";

import { platformClinicAction, platformOperationalAction } from "./actions";
import { ManualLockButton } from "./manual-lock-button";
import { PlatformDashboardView } from "./platform-dashboard";

export const dynamic = "force-dynamic";

function maskUserReference(value: string): string {
  return `Platform user ••••${value.replaceAll("-", "").slice(-6)}`;
}

async function logoutAction(): Promise<never> {
  "use server";
  const client = await createRequestAuthClient();
  await signOutSafely(client).catch(() => undefined);
  redirect("/login");
}

function PlatformNavigation({ mobile = false }: { readonly mobile?: boolean }) {
  return (
    <ShellNavigation compact={mobile} label="Platform navigation" mobile={mobile}>
      <ShellNavigationItem active href="#overview" icon="⌂" label="Overview" />
      <ShellNavigationItem href="#clinics" icon="◇" label="Clinics" />
      <ShellNavigationItem href="#platform-users" icon="◎" label="Platform users" />
      <ShellNavigationItem href="#sessions" icon="◷" label="Sessions" />
      <ShellNavigationItem href="#audit" icon="≡" label="Audit" />
    </ShellNavigation>
  );
}

export default async function PlatformPage() {
  const client = await createRequestAuthClient();
  await requireVerifiedAuthSession(client, "platform").catch(() => redirect("/login"));
  const session = await getActiveApplicationSession();
  if (!session || session.authorityScope !== "platform") redirect("/locked");
  const pool = createDatabasePool();
  const trusted = {
    applicationSessionId: session.id,
    providerIdentityId: session.platformUserId,
  };
  const [dashboard, sessionHealth, audit] = await Promise.all([
    readPlatformDashboard(pool, trusted),
    readPlatformSessionHealth(pool, trusted),
    readPlatformAudit(pool, trusted),
  ]).finally(() => pool.end());

  return (
    <SessionActivityBoundary
      lastActivityAt={session.lastActivityAt.toISOString()}
      showManualLock={false}
    >
      <PlatformShell
        activeUser={
          <ActiveUserIndicator
            label="Platform Owner"
            value={maskUserReference(session.platformUserId)}
          />
        }
        footer="Platform authority never grants routine tenant-record or clinical access."
        headerAction={
          <Inline>
            <ManualLockButton />
            <form action={logoutAction}>
              <Button size="small" type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </Inline>
        }
        mobileNavigation={<PlatformNavigation mobile />}
        navigation={<PlatformNavigation />}
        operationalContext={
          <StatusBadge label="Platform scope" size="small" variant="restricted" />
        }
        restrictedContext={
          <StatusBadge label="Administrative access" size="small" variant="restricted" />
        }
        toolbar={
          <ShellToolbar
            status={<span className="gv-platform-toolbar-context">Owner administration</span>}
            title={
              <div>
                <p className="gv-platform-eyebrow">GraftVision Platform</p>
                <h1>Platform administration</h1>
              </div>
            }
          />
        }
      >
        <PlatformDashboardView
          audit={audit}
          clinicAction={platformClinicAction}
          dashboard={dashboard}
          operationalAction={platformOperationalAction}
          sessionHealth={sessionHealth}
        />
      </PlatformShell>
    </SessionActivityBoundary>
  );
}
