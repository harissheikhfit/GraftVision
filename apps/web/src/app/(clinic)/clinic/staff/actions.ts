"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  createAuthAdminClient,
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  inviteUserByEmail,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import {
  createClinicStaffInvitation,
  createDatabasePool,
  deactivateClinicStaff,
  listPendingClinicInvitations,
  setClinicStaffRoles,
  transitionClinicStaffInvitation,
  type ClinicStaffRoleCode,
} from "@graftvision/database";

export interface StaffActionState {
  readonly message?: string;
  readonly success?: boolean;
}

const allowedRoleCodes = new Set<ClinicStaffRoleCode>([
  "CLINIC_OWNER",
  "CLINIC_ADMIN",
  "DOCTOR",
  "CLINICAL_ASSISTANT",
  "PROCEDURE_TECHNICIAN",
  "RECEPTION",
  "REPORT_COORDINATOR",
  "PRESENTATION",
  "REVIEWER",
]);

async function staffContext() {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic");
  const [user, session] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    throw new Error("staff context unavailable");
  }
  return {
    applicationSessionId: session.id,
    providerIdentityId: user.platformUserId,
  };
}

function roleFromForm(formData: FormData): ClinicStaffRoleCode {
  const role = formData.get("role");
  if (typeof role !== "string" || !allowedRoleCodes.has(role as ClinicStaffRoleCode)) {
    throw new Error("invalid role");
  }
  return role as ClinicStaffRoleCode;
}

export async function inviteStaffAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const email = formData.get("email");
  if (typeof email !== "string") return { message: "Invitation could not be created." };
  const providerReference = randomUUID();
  const pool = createDatabasePool();
  try {
    const context = await staffContext();
    const adminClient = createAuthAdminClient();
    await inviteUserByEmail(adminClient, email, {
      clinicInvitationReference: providerReference,
    });
    await createClinicStaffInvitation(pool, {
      ...context,
      email,
      providerReference,
      roleCodes: [roleFromForm(formData)],
    });
    revalidatePath("/clinic/staff");
    return { success: true };
  } catch {
    return { message: "Invitation could not be created." };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function resendInvitationAction(formData: FormData): Promise<void> {
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string") return;
  const pool = createDatabasePool();
  try {
    const context = await staffContext();
    const invitations = await listPendingClinicInvitations(pool, context);
    const invitation = invitations.find((candidate) => candidate.invitationId === invitationId);
    if (!invitation) return;
    const providerReference = randomUUID();
    await inviteUserByEmail(createAuthAdminClient(), invitation.normalizedEmail, {
      clinicInvitationReference: providerReference,
    });
    await transitionClinicStaffInvitation(pool, {
      ...context,
      action: "resend",
      invitationId,
      providerReference,
    });
    revalidatePath("/clinic/staff");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string") return;
  const pool = createDatabasePool();
  try {
    await transitionClinicStaffInvitation(pool, {
      ...(await staffContext()),
      action: "revoke",
      invitationId,
    });
    revalidatePath("/clinic/staff");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function changeStaffRoleAction(formData: FormData): Promise<void> {
  const membershipId = formData.get("membershipId");
  if (typeof membershipId !== "string") return;
  const pool = createDatabasePool();
  try {
    await setClinicStaffRoles(pool, {
      ...(await staffContext()),
      membershipId,
      roleCodes: [roleFromForm(formData)],
    });
    revalidatePath("/clinic/staff");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function deactivateStaffAction(formData: FormData): Promise<void> {
  const membershipId = formData.get("membershipId");
  if (typeof membershipId !== "string") return;
  const pool = createDatabasePool();
  try {
    await deactivateClinicStaff(pool, { ...(await staffContext()), membershipId });
    revalidatePath("/clinic/staff");
  } finally {
    await pool.end().catch(() => undefined);
  }
}
