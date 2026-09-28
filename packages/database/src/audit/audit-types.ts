import "server-only";

export const AUDIT_ACTIONS = [
  "audit.correct",
  "audit.create",
  "authority.cross_scope_denied",
  "authority.scope_change",
  "authorization.version_increment",
  "clinic.branding_conflict",
  "clinic.branding_update",
  "clinic.branding_view",
  "clinic.create",
  "clinic.inactivate",
  "clinic.onboarding_attest",
  "clinic.onboarding_blocked",
  "clinic.onboarding_ready",
  "clinic.onboarding_reopened",
  "clinic.read",
  "clinic.reactivate",
  "clinic.settings_conflict",
  "clinic.settings_update",
  "clinic.settings_view",
  "clinic.suspend",
  "consultation.create",
  "consultation.concurrency_conflict",
  "consultation.doctor_assign",
  "consultation.doctor_reassign",
  "consultation.status_change",
  "doctor.verification.expired",
  "doctor.verification.pending",
  "doctor.verification.rejected",
  "doctor.verification.revoked",
  "doctor.verification.verified",
  "invitation.accept",
  "invitation.create",
  "invitation.resend",
  "invitation.revoke",
  "membership.create",
  "membership.deactivate",
  "membership.read",
  "membership.role_assign",
  "membership.role_remove",
  "patient.create",
  "patient.duplicate_override",
  "patient.duplicate_warning",
  "patient.registration_create",
  "patient.status_change",
  "platform.admin",
  "role.assign",
  "role.remove",
  "session.create",
  "session.deny_inactive_user",
  "session.end",
  "session.expire_absolute",
  "session.expire_idle",
  "session.lock",
  "session.logout_after_lock",
  "session.reauthentication_failed",
  "session.revoke_authorization_change",
  "session.revoke_inactive_membership",
  "session.revoke_inactive_user",
  "session.revoke_other",
  "session.revoke_others",
  "session.unlock",
  "scan_session.complete",
  "scan_session.create",
  "scan_session.expire",
  "scan_session.pair",
  "scan_session.revoke",
  "scan_quality.retake_requested",
  "scan_quality.override_recorded",
  "scan_quality.analyzer_handoff_created",
  "scan_quality.validation_saved",
  "model.annotation_package_created",
  "model.landmark_saved",
  "model.curve_saved",
  "model.region_saved",
  "model.annotation_finalized",
  "model.annotation_superseded",
  "reconstruction.manifest_created",
  "reconstruction.job_created",
  "reconstruction.job_claimed",
  "reconstruction.job_progressed",
  "reconstruction.job_succeeded",
  "reconstruction.job_failed",
  "reconstruction.job_retried",
  "reconstruction.job_cancelled",
  "reconstruction.input_accessed",
  "reconstruction.asset_normalized",
  "reconstruction.prepared_manifest_created",
  "reconstruction.preparation_failed",
  "reconstruction.execution_started",
  "reconstruction.artifact_recorded",
  "reconstruction.output_manifest_created",
  "reconstruction.execution_succeeded",
  "reconstruction.execution_failed",
  "storage_key.validate",
  "system.migration",
  "planning.package_created",
  "planning.calculation_completed",
  "planning.assumptions_updated",
  "planning.finalized",
  "planning.superseded",
] as const;

export const AUDIT_ACTOR_TYPES = ["system", "user"] as const;

export const AUDIT_RESOURCE_TYPES = [
  "audit_event",
  "application_session",
  "clinic",
  "clinic_invitation",
  "clinic_membership",
  "clinic_membership_role",
  "consultation",
  "consultation_assignment",
  "doctor_verification",
  "patient",
  "platform_user",
  "platform_user_role",
  "scan_session",
  "scan_capture_quality_result",
  "scan_analyzer_handoff",
  "reconstruction_input_manifest",
  "reconstruction_job",
  "reconstruction_prepared_asset",
  "reconstruction_prepared_manifest",
  "reconstruction_artifact",
  "reconstruction_output_manifest",
  "storage_object_key",
  "system",
  "planning_package",
] as const;

export const AUDIT_OUTCOMES = ["denied", "failure", "success"] as const;

export const AUDIT_SOURCE_APPLICATIONS = ["database", "present", "scan", "system", "web"] as const;

export const AUDIT_METADATA_KEYS = [
  "affected_count",
  "asset_id",
  "capture_step",
  "assigned_role",
  "changed_fields",
  "current_revision",
  "device_label",
  "error_code",
  "expected_revision",
  "new_status",
  "new_version",
  "operation_code",
  "outcome_code",
  "override_reason_code",
  "policy_decision_code",
  "previous_status",
  "prior_quality_state",
  "removed_role",
  "reason_code",
  "route_family",
  "result_revision",
  "scan_session_id",
  "storage_object_class",
  "validator_version",
] as const;

export const AUDIT_METADATA_MAX_BYTES = 2048;

export const AUDIT_ERROR_CODES = [
  "AUDIT_ACTOR_CONTEXT_REQUIRED",
  "AUDIT_METADATA_TOO_LARGE",
  "AUDIT_TENANT_CONTEXT_REQUIRED",
  "AUDIT_WRITE_FAILED",
  "INVALID_AUDIT_ACTION",
  "INVALID_AUDIT_METADATA",
  "INVALID_AUDIT_OUTCOME",
  "INVALID_AUDIT_REQUEST_ID",
  "INVALID_AUDIT_RESOURCE",
  "INVALID_AUDIT_RESOURCE_ID",
  "INVALID_AUDIT_SOURCE_APPLICATION",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
export type AuditSourceApplication = (typeof AUDIT_SOURCE_APPLICATIONS)[number];
export type AuditMetadataKey = (typeof AUDIT_METADATA_KEYS)[number];
export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number];

export interface AuditMetadata {
  readonly affected_count?: number;
  readonly assigned_role?: string;
  readonly changed_fields?: readonly string[];
  readonly current_revision?: number;
  readonly device_label?: string;
  readonly error_code?: string;
  readonly expected_revision?: number;
  readonly new_status?: string;
  readonly new_version?: number;
  readonly operation_code?: string;
  readonly outcome_code?: string;
  readonly policy_decision_code?: string;
  readonly previous_status?: string;
  readonly removed_role?: string;
  readonly reason_code?: string;
  readonly route_family?: string;
  readonly storage_object_class?: string;
}

export interface AuditEventInput {
  readonly action: AuditAction;
  readonly metadata?: AuditMetadata;
  readonly outcome: AuditOutcome;
  readonly reasonCode?: string;
  readonly requestId?: string;
  readonly resourceId?: string;
  readonly resourceType: AuditResourceType;
  readonly sourceApplication: AuditSourceApplication;
}

export interface AuditEventRecord {
  readonly action: AuditAction;
  readonly actorPlatformUserId: string | null;
  readonly actorType: AuditActorType;
  readonly clinicId: string | null;
  readonly id: string;
  readonly metadata: AuditMetadata;
  readonly occurredAt: string;
  readonly outcome: AuditOutcome;
  readonly requestId: string | null;
  readonly resourceId: string | null;
  readonly resourceType: AuditResourceType;
  readonly sourceApplication: AuditSourceApplication;
}
