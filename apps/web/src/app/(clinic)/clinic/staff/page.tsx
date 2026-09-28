import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createDatabasePool,
  getClinicStaffManagerRole,
  listClinicStaff,
  listPendingClinicInvitations,
} from "@graftvision/database";
import {
  Button,
  ClinicShell,
  Field,
  InformationPanel,
  Inline,
  KeyValueList,
  Section,
  Select,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../session-activity-boundary";

import {
  changeStaffRoleAction,
  deactivateStaffAction,
  resendInvitationAction,
  revokeInvitationAction,
} from "./actions";
import { InviteStaffForm } from "./invite-staff-form";

export const dynamic = "force-dynamic";

export default async function ClinicStaffPage() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  const pool = createDatabasePool();
  const context = {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
  const [staff, invitations, managerRole] = await Promise.all([
    listClinicStaff(pool, context),
    listPendingClinicInvitations(pool, context),
    getClinicStaffManagerRole(pool, context),
  ]).finally(() => pool.end());
  const canManageHighRiskRoles = managerRole === "CLINIC_OWNER";

  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
            <ShellNavigationItem href="/clinic/settings" label="Settings" />
            <ShellNavigationItem href="/clinic/settings/branding" label="Branding" />
            <ShellNavigationItem active href="/clinic/staff" label="Staff management" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Clinic staff management</h1>} />}
      >
        <Stack gap="8">
          <Section heading="Invite staff member">
            <InviteStaffForm canManageHighRiskRoles={canManageHighRiskRoles} />
          </Section>
          <Section heading="Pending invitations">
            <Stack gap="4">
              {invitations.map((invitation) => (
                <InformationPanel
                  key={invitation.invitationId}
                  description="Pending clinic staff invitation"
                  heading={invitation.normalizedEmail}
                >
                  <Stack gap="3">
                    <KeyValueList
                      items={[
                        { id: "roles", label: "Roles", value: invitation.roleCodes.join(", ") },
                        {
                          id: "expires",
                          label: "Expires",
                          value: invitation.expiresAt.toISOString(),
                        },
                      ]}
                    />
                    <Inline gap="3">
                      <form action={resendInvitationAction}>
                        <input name="invitationId" type="hidden" value={invitation.invitationId} />
                        <Button type="submit" variant="secondary">
                          Resend
                        </Button>
                      </form>
                      <form action={revokeInvitationAction}>
                        <input name="invitationId" type="hidden" value={invitation.invitationId} />
                        <Button type="submit" variant="destructive">
                          Revoke
                        </Button>
                      </form>
                    </Inline>
                  </Stack>
                </InformationPanel>
              ))}
            </Stack>
          </Section>
          <Section heading="Clinic staff">
            <Stack gap="4">
              {staff.map((member) => (
                <InformationPanel
                  key={member.membershipId}
                  description="Clinic-scoped staff access"
                  heading="Clinic staff member"
                >
                  <Stack gap="3">
                    <KeyValueList
                      items={[
                        { id: "status", label: "Status", value: member.membershipStatus },
                        { id: "roles", label: "Roles", value: member.roleCodes.join(", ") },
                      ]}
                    />
                    <Inline gap="3">
                      <form action={changeStaffRoleAction}>
                        <input name="membershipId" type="hidden" value={member.membershipId} />
                        <Field label="Role">
                          {(control) => (
                            <Select {...control} defaultValue={member.roleCodes[0]} name="role">
                              <option value="CLINICAL_ASSISTANT">Clinical Assistant</option>
                              <option value="PROCEDURE_TECHNICIAN">Procedure Technician</option>
                              <option value="RECEPTION">Reception User</option>
                              <option value="REPORT_COORDINATOR">Report Coordinator</option>
                              <option value="PRESENTATION">Presentation User</option>
                              <option value="REVIEWER">Reviewer</option>
                              {canManageHighRiskRoles ? (
                                <>
                                  <option value="CLINIC_ADMIN">Clinic Administrator</option>
                                  <option value="DOCTOR">Doctor</option>
                                  <option value="CLINIC_OWNER">Clinic Owner</option>
                                </>
                              ) : null}
                            </Select>
                          )}
                        </Field>
                        <Button type="submit" variant="secondary">
                          Change role
                        </Button>
                      </form>
                      <form action={deactivateStaffAction}>
                        <input name="membershipId" type="hidden" value={member.membershipId} />
                        <Button type="submit" variant="destructive">
                          Deactivate
                        </Button>
                      </form>
                    </Inline>
                  </Stack>
                </InformationPanel>
              ))}
            </Stack>
          </Section>
        </Stack>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
