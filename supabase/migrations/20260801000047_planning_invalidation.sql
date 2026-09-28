-- PLAN-002: controlled invalidation when an upstream geometry revision changes.
-- graftvision:dangerous-sql-approved task=PLAN-002
-- graftvision:dangerous-sql-reason Row locks, exact revisions, idempotency, and audit prevent stale planning from remaining applicable.
-- graftvision:corrective-plan Forward-fix through an additive migration; finalized planning history remains preserved.

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
    'consultation.reopen', 'planning.finalized', 'planning.invalidated', 'scan_session.create',
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

create or replace function graftvision_private.invalidate_planning_package(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_package_id uuid,
  p_expected_revision integer,
  p_geometry_revision integer,
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
    and request_family = 'invalidate'
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
  if p_geometry_revision <= v_package.geometry_revision then
    raise exception using errcode = '22023', message = 'PLANNING_GEOMETRY_REVISION_INVALID';
  end if;
  if v_package.package_state not in ('calculated', 'finalized') then
    raise exception using errcode = '22023', message = 'PLANNING_NOT_INVALIDATABLE';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);
  update public.planning_package
  set package_state = 'stale', geometry_revision = p_geometry_revision, revision = revision + 1
  where id = p_package_id;

  insert into public.planning_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_status, result_revision
  ) values (
    v_package.clinic_id, v_actor.platform_user_id, 'invalidate', p_idempotency_key,
    encode(extensions.digest(p_package_id::text || ':' || p_expected_revision::text || ':' || p_geometry_revision::text, 'sha256'), 'hex'),
    p_package_id, 'finalized', v_package.revision + 1
  );

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_package.clinic_id, v_actor.platform_user_id, 'user', 'planning.invalidated',
    'planning_package', p_package_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('revision', v_package.revision + 1, 'geometry_revision', p_geometry_revision)
  );

  return query select v_package.revision + 1, true;
end;
$$;

revoke all on function graftvision_private.invalidate_planning_package(uuid, uuid, uuid, integer, integer, uuid)
from public, anon, authenticated;