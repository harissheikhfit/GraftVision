-- SCAN-004 corrective migration: retain the declared scan-media audit actions.
-- graftvision:dangerous-sql-approved task=SCAN-004
-- graftvision:dangerous-sql-reason Protected media operations already emit these actions; the allowlist must accept them.
-- graftvision:corrective-plan Add only the two existing scan-media actions; no audit controls are removed.

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = '' as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.branding_conflict', 'clinic.branding_update',
    'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.onboarding_attest',
    'clinic.onboarding_blocked', 'clinic.onboarding_ready', 'clinic.onboarding_reopened',
    'clinic.read', 'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
    'clinic.settings_view', 'clinic.suspend', 'consultation.concurrency_conflict',
    'consultation.create', 'consultation.doctor_assign', 'consultation.doctor_reassign',
    'consultation.status_change', 'consultation.complete', 'consultation.reopen',
    'clinical_history.version_create', 'clinical_history.material_amend',
    'clinical_history.submit_review', 'clinical_history.doctor_review',
    'clinical_history.amendment_request', 'clinical_history.supersede', 'clinical_history.retract',
    'doctor_private_note.create', 'doctor_private_note.amend', 'doctor_private_note.retract',
    'doctor_private_note.sensitive_read', 'doctor.verification.expired',
    'doctor.verification.pending', 'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create', 'invitation.resend',
    'invitation.revoke', 'membership.create', 'membership.deactivate', 'membership.read',
    'membership.reactivate', 'membership.role_assign', 'membership.role_remove',
    'membership.suspend', 'patient.archive', 'patient.create', 'patient.duplicate_override',
    'patient.duplicate_warning', 'patient.privacy_acknowledge', 'patient.privacy_withdraw',
    'patient.registration_create', 'patient.restore', 'patient.status_change', 'platform.admin',
    'role.assign', 'role.remove', 'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock', 'session.logout_after_lock',
    'session.reauthentication_failed', 'session.revoke_authorization_change',
    'session.revoke_inactive_membership', 'session.revoke_inactive_user', 'session.revoke_other',
    'session.revoke_others', 'session.unlock', 'storage_key.validate', 'system.migration',
    'user.deactivate', 'user.reactivate', 'preliminary_assessment.version_create',
    'preliminary_assessment.doctor_review', 'preliminary_assessment.supersede',
    'preliminary_assessment.retract', 'planning.finalized', 'planning.invalidated',
    'scan_session.create', 'scan_session.complete', 'scan_session.expire', 'scan_session.pair',
    'scan_session.revoke', 'scan_session.transition', 'scan_capture.upload_completed',
    'scan_capture.asset_superseded', 'scan_capture.preview_accessed', 'scan_quality.validation_saved',
    'scan_quality.retake_requested', 'scan_quality.override_recorded',
    'scan_quality.analyzer_handoff_created', 'reconstruction.manifest_created',
    'reconstruction.job_created', 'reconstruction.job_claimed', 'reconstruction.job_progressed',
    'reconstruction.job_retried',
    'reconstruction.job_succeeded', 'reconstruction.job_failed', 'reconstruction.job_cancelled',
    'reconstruction.input_accessed', 'reconstruction.asset_normalized',
    'reconstruction.prepared_manifest_created', 'reconstruction.preparation_failed',
    'reconstruction.execution_started', 'reconstruction.execution_succeeded',
    'reconstruction.execution_failed', 'reconstruction.artifact_recorded',
    'reconstruction.output_manifest_created', 'region.version_created'
  );
$$;

revoke all on function graftvision_private.is_valid_audit_action(text)
from public, anon, authenticated;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean
language sql
immutable
set search_path = '' as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation',
    'clinic_membership', 'clinic_membership_role', 'consultation',
    'consultation_assignment', 'clinical_history', 'doctor_private_note',
    'doctor_verification', 'patient', 'patient_privacy_acknowledgement',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system',
    'preliminary_assessment', 'consultation_lifecycle_event', 'scan_session',
    'scan_capture_asset', 'scan_capture_quality_result', 'scan_analyzer_handoff',
    'reconstruction_input_manifest', 'reconstruction_job', 'reconstruction_prepared_asset',
    'reconstruction_prepared_manifest', 'reconstruction_artifact', 'reconstruction_output_manifest'
  );
$$;

revoke all on function graftvision_private.is_valid_audit_resource_type(text)
from public, anon, authenticated;
