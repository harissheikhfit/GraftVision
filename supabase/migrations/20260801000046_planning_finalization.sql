-- PLAN-001: controlled Doctor finalization for calculated planning packages.
-- graftvision:dangerous-sql-approved task=PLAN-001
-- graftvision:dangerous-sql-reason Doctor authority, row locks, revision checks, idempotency, and audit preserve planning integrity.
-- graftvision:corrective-plan Forward-fix through an additive migration; calculated packages and prior audit history remain preserved.

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.branding_conflict', 'clinic.branding_update',
    'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.onboarding_attest',
    'clinic.onboarding_blocked', 'clinic.onboarding_ready', 'clinic.onboarding_reopened',
    'clinic.read', 'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
    'clinic.settings_view', 'clinic.suspend', 'consultation.concurrency_conflict',
    'consultation.create', 'consultation.doctor_assign', 'consultation.doctor_reassign',
    'consultation.status_change', 'clinical_history.version_create',
    'clinical_history.material_amend', 'clinical_history.submit_review',
    'clinical_history.doctor_review', 'clinical_history.amendment_request',
    'clinical_history.supersede', 'clinical_history.retract', 'doctor_private_note.create',
    'doctor_private_note.amend', 'doctor_private_note.retract', 'doctor_private_note.sensitive_read',
    'doctor.verification.expired', 'doctor.verification.pending', 'doctor.verification.rejected',
    'doctor.verification.revoked', 'doctor.verification.verified', 'invitation.accept',
    'invitation.create', 'invitation.resend', 'invitation.revoke', 'membership.create',
    'membership.deactivate', 'membership.read', 'membership.reactivate', 'membership.role_assign',
    'membership.role_remove', 'membership.suspend', 'patient.archive', 'patient.create',
    'patient.duplicate_override', 'patient.duplicate_warning', 'patient.privacy_acknowledge',
    'patient.privacy_withdraw', 'patient.registration_create', 'patient.restore',
    'patient.status_change', 'platform.admin', 'role.assign', 'role.remove', 'session.create',
    'session.deny_inactive_user', 'session.end', 'session.expire_absolute', 'session.expire_idle',
    'session.lock', 'session.logout_after_lock', 'session.reauthentication_failed',
    'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other', 'session.revoke_others',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate',
    'preliminary_assessment.version_create', 'preliminary_assessment.doctor_review',
    'preliminary_assessment.supersede', 'preliminary_assessment.retract', 'consultation.complete',
    'consultation.reopen', 'planning.finalized', 'scan_session.create',
    'scan_session.complete', 'scan_session.expire', 'scan_session.pair',
    'scan_session.revoke', 'scan_session.transition', 'session.unlock',
    'reconstruction.job_created', 'reconstruction.job_claimed',
    'reconstruction.job_progressed', 'reconstruction.job_retried',
    'reconstruction.job_succeeded', 'reconstruction.job_failed',
    'reconstruction.job_cancelled', 'reconstruction.input_accessed',
    'reconstruction.asset_normalized', 'reconstruction.prepared_manifest_created',
    'reconstruction.preparation_failed', 'reconstruction.execution_started',
    'reconstruction.execution_succeeded', 'reconstruction.execution_failed',
    'reconstruction.artifact_recorded', 'reconstruction.output_manifest_created'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation', 'clinic_membership',
    'clinic_membership_role', 'consultation', 'consultation_assignment', 'clinical_history',
    'doctor_private_note', 'doctor_verification', 'patient', 'patient_privacy_acknowledgement',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system',
    'preliminary_assessment', 'consultation_lifecycle_event', 'planning_package',
    'scan_session', 'reconstruction_job', 'reconstruction_input_manifest',
    'reconstruction_prepared_asset', 'reconstruction_prepared_manifest',
    'reconstruction_output_manifest', 'reconstruction_artifact', 'reconstruction_preview'
  );
$$;

create or replace function graftvision_private.finalize_planning_package(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_package_id uuid,
  p_expected_revision integer,
  p_idempotency_key uuid
) returns table (revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_package public.planning_package%rowtype;
  v_actor record;
  v_existing public.planning_idempotency%rowtype;
begin
  select * into strict v_package
  from public.planning_package
  where id = p_package_id
  for update;

  select * into strict v_actor
  from graftvision_private.assert_consultation_doctor_authority(
    p_session_id, p_provider_identity_id, v_package.consultation_id
  );

  if v_package.clinic_id <> v_actor.clinic_id then
    raise exception using errcode = '42501', message = 'PLANNING_ACCESS_DENIED';
  end if;

  select * into v_existing
  from public.planning_idempotency
  where clinic_id = v_package.clinic_id
    and actor_platform_user_id = v_actor.platform_user_id
    and request_family = 'finalize'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.result_resource_id <> p_package_id then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_existing.result_revision, false;
    return;
  end if;

  if v_package.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PLANNING_REVISION_CONFLICT';
  end if;
  if v_package.package_state <> 'calculated' then
    raise exception using errcode = '22023', message = 'PLANNING_NOT_CALCULATED';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);
  update public.planning_package
  set package_state = 'finalized', finalized_at = clock_timestamp(), revision = revision + 1
  where id = p_package_id;

  insert into public.planning_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_status, result_revision
  ) values (
    v_package.clinic_id, v_actor.platform_user_id, 'finalize', p_idempotency_key,
    encode(extensions.digest(p_package_id::text || ':' || p_expected_revision::text, 'sha256'), 'hex'),
    p_package_id, 'finalized', v_package.revision + 1
  );

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_package.clinic_id, v_actor.platform_user_id, 'user', 'planning.finalized',
    'planning_package', p_package_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('revision', v_package.revision + 1)
  );

  return query select v_package.revision + 1, true;
end;
$$;

revoke all on function graftvision_private.finalize_planning_package(uuid, uuid, uuid, integer, uuid)
from public, anon, authenticated;
