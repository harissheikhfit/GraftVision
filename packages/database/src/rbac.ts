import "server-only";

import { writeAuditEvent } from "./audit/audit-event";
import { DatabaseBoundaryError } from "./server";

import type { TenantTransaction } from "./server";

const safeCodePattern = /^[A-Za-z_]{1,63}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function optionalRequestId(requestId: string | undefined): { readonly requestId?: string } {
  return requestId === undefined ? {} : { requestId };
}

export async function assignClinicRole(
  transaction: TenantTransaction,
  clinicMembershipId: string,
  roleCode: string,
  requestId?: string,
): Promise<number> {
  if (!uuidPattern.test(clinicMembershipId)) {
    throw new DatabaseBoundaryError("Invalid clinic membership ID");
  }
  if (!safeCodePattern.test(roleCode)) {
    throw new DatabaseBoundaryError("Invalid role code");
  }

  try {
    const checkResult = await transaction.query<{ readonly clinic_id: string }>(
      `select clinic_id from public.clinic_membership where id = $1::uuid`,
      [clinicMembershipId],
    );
    const clinicId = checkResult.rows[0]?.clinic_id;
    if (!clinicId) throw new DatabaseBoundaryError("Membership not found");

    await transaction.query(
      `select graftvision_private.check_clinic_role_assignment($1::uuid, $2::text, false)`,
      [clinicId, roleCode],
    );

    await transaction.query(
      `insert into public.clinic_membership_role (clinic_membership_id, role_code) values ($1::uuid, $2::text)`,
      [clinicMembershipId, roleCode],
    );

    const versionResult = await transaction.query<{ readonly authorization_version: number }>(
      `select authorization_version from public.clinic_membership where id = $1::uuid`,
      [clinicMembershipId],
    );

    const newVersion = versionResult.rows[0]?.authorization_version;

    if (newVersion === undefined) {
      throw new DatabaseBoundaryError("Failed to read new authorization version");
    }

    await writeAuditEvent(transaction, {
      action: "role.assign",
      metadata: { assigned_role: roleCode, new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: clinicMembershipId,
      resourceType: "clinic_membership_role",
      sourceApplication: "database",
    });

    await writeAuditEvent(transaction, {
      action: "authorization.version_increment",
      metadata: { new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: clinicMembershipId,
      resourceType: "clinic_membership",
      sourceApplication: "database",
    });

    return newVersion;
  } catch (error) {
    if (error instanceof Error && error.message.includes("PATIENT")) {
      throw new DatabaseBoundaryError(
        "PATIENT role assignment through clinic_membership_role is prohibited",
      );
    }
    throw new DatabaseBoundaryError("Failed to assign clinic role");
  }
}

export async function removeClinicRole(
  transaction: TenantTransaction,
  clinicMembershipId: string,
  roleCode: string,
  requestId?: string,
): Promise<number> {
  if (!uuidPattern.test(clinicMembershipId)) {
    throw new DatabaseBoundaryError("Invalid clinic membership ID");
  }
  if (!safeCodePattern.test(roleCode)) {
    throw new DatabaseBoundaryError("Invalid role code");
  }

  try {
    const checkResult = await transaction.query<{ readonly clinic_id: string }>(
      `select clinic_id from public.clinic_membership where id = $1::uuid`,
      [clinicMembershipId],
    );
    const clinicId = checkResult.rows[0]?.clinic_id;
    if (!clinicId) throw new DatabaseBoundaryError("Membership not found");

    await transaction.query(
      `select graftvision_private.check_clinic_role_assignment($1::uuid, $2::text, true)`,
      [clinicId, roleCode],
    );

    const result = await transaction.query(
      `delete from public.clinic_membership_role where clinic_membership_id = $1::uuid and role_code = $2::text`,
      [clinicMembershipId, roleCode],
    );

    if (result.rowCount === 0) {
      throw new DatabaseBoundaryError("Role not found on membership");
    }

    const versionResult = await transaction.query<{ readonly authorization_version: number }>(
      `select authorization_version from public.clinic_membership where id = $1::uuid`,
      [clinicMembershipId],
    );

    const newVersion = versionResult.rows[0]?.authorization_version;

    if (newVersion === undefined) {
      throw new DatabaseBoundaryError("Failed to read new authorization version");
    }

    await writeAuditEvent(transaction, {
      action: "role.remove",
      metadata: { removed_role: roleCode, new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: clinicMembershipId,
      resourceType: "clinic_membership_role",
      sourceApplication: "database",
    });

    await writeAuditEvent(transaction, {
      action: "authorization.version_increment",
      metadata: { new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: clinicMembershipId,
      resourceType: "clinic_membership",
      sourceApplication: "database",
    });

    return newVersion;
  } catch {
    throw new DatabaseBoundaryError("Failed to remove clinic role");
  }
}

export async function assignPlatformRole(
  transaction: TenantTransaction,
  platformUserId: string,
  roleCode: string,
  requestId?: string,
): Promise<number> {
  if (!uuidPattern.test(platformUserId)) {
    throw new DatabaseBoundaryError("Invalid platform user ID");
  }
  if (!safeCodePattern.test(roleCode)) {
    throw new DatabaseBoundaryError("Invalid role code");
  }

  try {
    await transaction.query(
      `select graftvision_private.check_platform_role_assignment($1::text, false)`,
      [roleCode],
    );

    await transaction.query(
      `insert into public.platform_user_role (platform_user_id, role_code) values ($1::uuid, $2::text)`,
      [platformUserId, roleCode],
    );

    const versionResult = await transaction.query<{ readonly authorization_version: number }>(
      `select authorization_version from public.platform_user where id = $1::uuid`,
      [platformUserId],
    );

    const newVersion = versionResult.rows[0]?.authorization_version;

    if (newVersion === undefined) {
      throw new DatabaseBoundaryError("Failed to read new authorization version");
    }

    await writeAuditEvent(transaction, {
      action: "role.assign",
      metadata: { assigned_role: roleCode, new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: platformUserId,
      resourceType: "platform_user_role",
      sourceApplication: "database",
    });

    await writeAuditEvent(transaction, {
      action: "authorization.version_increment",
      metadata: { new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: platformUserId,
      resourceType: "platform_user",
      sourceApplication: "database",
    });

    return newVersion;
  } catch {
    throw new DatabaseBoundaryError("Failed to assign platform role");
  }
}

export async function removePlatformRole(
  transaction: TenantTransaction,
  platformUserId: string,
  roleCode: string,
  requestId?: string,
): Promise<number> {
  if (!uuidPattern.test(platformUserId)) {
    throw new DatabaseBoundaryError("Invalid platform user ID");
  }
  if (!safeCodePattern.test(roleCode)) {
    throw new DatabaseBoundaryError("Invalid role code");
  }

  try {
    await transaction.query(
      `select graftvision_private.check_platform_role_assignment($1::text, true)`,
      [roleCode],
    );

    const result = await transaction.query(
      `delete from public.platform_user_role where platform_user_id = $1::uuid and role_code = $2::text`,
      [platformUserId, roleCode],
    );

    if (result.rowCount === 0) {
      throw new DatabaseBoundaryError("Role not found on platform user");
    }

    const versionResult = await transaction.query<{ readonly authorization_version: number }>(
      `select authorization_version from public.platform_user where id = $1::uuid`,
      [platformUserId],
    );

    const newVersion = versionResult.rows[0]?.authorization_version;

    if (newVersion === undefined) {
      throw new DatabaseBoundaryError("Failed to read new authorization version");
    }

    await writeAuditEvent(transaction, {
      action: "role.remove",
      metadata: { removed_role: roleCode, new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: platformUserId,
      resourceType: "platform_user_role",
      sourceApplication: "database",
    });

    await writeAuditEvent(transaction, {
      action: "authorization.version_increment",
      metadata: { new_version: newVersion },
      outcome: "success",
      ...optionalRequestId(requestId),
      resourceId: platformUserId,
      resourceType: "platform_user",
      sourceApplication: "database",
    });

    return newVersion;
  } catch {
    throw new DatabaseBoundaryError("Failed to remove platform role");
  }
}
