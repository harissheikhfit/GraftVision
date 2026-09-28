-- Migration: 20260801000003_complete_consultation_revision_qualification.sql
-- Purpose: Fix ambiguous revision column reference in complete_consultation

create or replace function graftvision_private.complete_consultation(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid
)
returns table (
  outcome_code text,
  revision integer,
  medical_history_version_id uuid,
  hair_loss_history_version_id uuid,
  preliminary_assessment_version_id uuid
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_consultation public.consultation%rowtype;
  v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
  v_med_hist public.patient_medical_history%rowtype;
  v_hair_hist public.consultation_hair_loss_history%rowtype;
  v_assessment public.preliminary_assessment%rowtype;
  v_assessment_ver public.preliminary_assessment_version%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  ) then raise exception using errcode = '42501', message = 'CONSULTATION_ACCESS_DENIED'; end if;

  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  
  v_payload_hash := encode(extensions.digest(p_consultation_id::text, 'sha256'::text), 'hex');

  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'consultation.complete'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_revision, 
      (v_existing.result_status::jsonb->>'medical_history_version_id')::uuid,
      (v_existing.result_status::jsonb->>'hair_loss_history_version_id')::uuid,
      (v_existing.result_status::jsonb->>'preliminary_assessment_version_id')::uuid; 
    return;
  end if;

  select * into v_consultation from public.consultation
  where clinic_id = v_context.clinic_id and id = p_consultation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CONSULTATION_NOT_FOUND'; end if;

  if v_consultation.revision <> p_expected_revision then
    return query select 'stale_revision', v_consultation.revision, null::uuid, null::uuid, null::uuid; return;
  end if;
  
  if v_consultation.status <> 'in_progress' then
    return query select 'INVALID_TRANSITION', v_consultation.revision, null::uuid, null::uuid, null::uuid; return;
  end if;

  -- Load root pointers
  select * into v_med_hist from public.patient_medical_history
  where clinic_id = v_context.clinic_id and patient_id = v_consultation.patient_id;
  
  select * into v_hair_hist from public.consultation_hair_loss_history
  where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id;
  
  select * into v_assessment from public.preliminary_assessment
  where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id;

  if v_med_hist.current_version_id is null or v_med_hist.review_state <> 'doctor_reviewed'
  or v_hair_hist.current_version_id is null or v_hair_hist.review_state <> 'doctor_reviewed'
  or v_assessment.current_version_id is null or v_assessment.review_state <> 'doctor_reviewed'
  then
    return query select 'CLINICAL_EVIDENCE_NOT_READY', v_consultation.revision, null::uuid, null::uuid, null::uuid; return;
  end if;

  select * into v_assessment_ver from public.preliminary_assessment_version
  where id = v_assessment.current_version_id;

  if v_assessment_ver.downstream_stale then
    return query select 'CLINICAL_EVIDENCE_NOT_READY', v_consultation.revision, null::uuid, null::uuid, null::uuid; return;
  end if;

  if v_assessment_ver.patient_medical_history_version_id <> v_med_hist.current_version_id or
     v_assessment_ver.consultation_hair_loss_history_version_id <> v_hair_hist.current_version_id then
    return query select 'ASSESSMENT_BINDING_MISMATCH', v_consultation.revision, null::uuid, null::uuid, null::uuid; return;
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);

  update public.consultation as c set
    status = 'completed',
    revision = c.revision + 1,
    updated_at = clock_timestamp(),
    updated_by = p_actor_id
  where c.id = p_consultation_id
  returning c.revision into v_consultation.revision;
  
  insert into public.consultation_lifecycle_event (
    clinic_id, consultation_id, event_type, consultation_revision,
    medical_history_version_id, hair_loss_history_version_id, preliminary_assessment_version_id,
    actor_platform_user_id, request_id
  ) values (
    v_context.clinic_id, p_consultation_id, 'completed', v_consultation.revision,
    v_med_hist.current_version_id, v_hair_hist.current_version_id, v_assessment.current_version_id,
    p_actor_id, p_session_id
  );

  insert into public.clinical_operation_idempotency (
    clinic_id, actor_platform_user_id, aggregate_id, request_family,
    idempotency_key, payload_hash, result_resource_id, result_version_id,
    result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'consultation.complete',
    p_idempotency_key, v_payload_hash, p_consultation_id,
    v_assessment.current_version_id, v_consultation.revision,
    jsonb_build_object(
      'medical_history_version_id', v_med_hist.current_version_id,
      'hair_loss_history_version_id', v_hair_hist.current_version_id,
      'preliminary_assessment_version_id', v_assessment.current_version_id
    )::text
  );

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user', 'consultation.complete',
    'consultation_lifecycle_event', p_consultation_id, 'success', p_idempotency_key,
    'database', jsonb_build_object('new_version', v_consultation.revision, 'new_status', 'completed')
  );

  return query select 'success', v_consultation.revision, v_med_hist.current_version_id, v_hair_hist.current_version_id, v_assessment.current_version_id;
end;
$$;

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
    'consultation.status_change', 'consultation.complete', 'consultation.reopen',
    'clinical_history.version_create', 'clinical_history.material_amend',
    'clinical_history.submit_review', 'clinical_history.doctor_review',
    'clinical_history.amendment_request', 'clinical_history.supersede',
    'clinical_history.retract', 'doctor_private_note.create', 'doctor_private_note.amend',
    'doctor_private_note.retract', 'doctor_private_note.sensitive_read',
    'doctor.verification.expired', 'doctor.verification.pending',
    'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate',
    'membership.read', 'membership.reactivate', 'membership.role_assign',
    'membership.role_remove', 'membership.suspend', 'patient.archive', 'patient.create',
    'patient.duplicate_override', 'patient.duplicate_warning',
    'patient.privacy_acknowledge', 'patient.privacy_withdraw',
    'patient.registration_create', 'patient.restore', 'patient.status_change',
    'platform.admin', 'role.assign', 'role.remove', 'session.create',
    'session.deny_inactive_user', 'session.end', 'session.expire_absolute',
    'session.expire_idle', 'session.lock', 'session.logout_after_lock',
    'session.reauthentication_failed', 'session.revoke_authorization_change',
    'session.revoke_inactive_membership', 'session.revoke_inactive_user',
    'session.revoke_other', 'session.revoke_others', 'session.unlock',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate',
    'preliminary_assessment.version_create', 'preliminary_assessment.doctor_review',
    'preliminary_assessment.supersede', 'preliminary_assessment.retract',
    'scan_session.create', 'scan_session.pair', 'scan_session.complete',
    'scan_session.revoke', 'scan_session.expire'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation',
    'clinic_membership', 'clinic_membership_role', 'consultation',
    'consultation_assignment', 'clinical_history', 'doctor_private_note',
    'doctor_verification', 'patient', 'patient_privacy_acknowledgement',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system',
    'preliminary_assessment', 'consultation_lifecycle_event', 'scan_session'
  );
$$;

create or replace function graftvision_private.transition_scan_session_status(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid,
  p_new_status text, p_reason text, p_idempotency_key text
)
returns table (scan_session_id uuid, revision integer, status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing_idempotency public.scan_operation_idempotency%rowtype;
  v_current public.scan_session%rowtype;
  v_audit_action text;
begin
  if p_new_status not in ('completed', 'revoked', 'expired') then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';
  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'CLINICAL-PERM-002') then
    raise exception using errcode = '42501', message = 'INSUFFICIENT_CLINICAL_PERMISSION';
  end if;
  select * into v_existing_idempotency from public.scan_operation_idempotency
  where clinic_id = v_clinic_id and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.transition' and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing_idempotency.scan_session_id,
      v_existing_idempotency.result_revision, p_new_status;
    return;
  end if;
  select * into strict v_current from public.scan_session
  where id = p_scan_session_id and clinic_id = v_clinic_id for update;
  if (p_new_status = 'completed' and v_current.status <> 'paired')
    or (p_new_status = 'revoked' and v_current.status not in ('created', 'paired'))
    or (p_new_status = 'expired' and v_current.status <> 'created') then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;
  perform set_config('graftvision.scan_controlled', 'on', true);
  update public.scan_session as s
  set status = p_new_status, revocation_reason = p_reason, updated_at = clock_timestamp(),
    revision = s.revision + 1
  where s.id = p_scan_session_id;
  insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
  values (p_scan_session_id, v_clinic_id, p_new_status, v_actor_id);
  v_audit_action := case p_new_status
    when 'completed' then 'scan_session.complete'
    when 'revoked' then 'scan_session.revoke'
    else 'scan_session.expire'
  end;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_clinic_id, v_actor_id, 'user', v_audit_action,
    'scan_session', p_scan_session_id, 'success', p_idempotency_key::uuid, 'database',
    jsonb_build_object('new_status', p_new_status, 'new_version', v_current.revision + 1)
  );
  insert into public.scan_operation_idempotency(
    clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision
  ) values (
    v_clinic_id, v_actor_id, 'scan_session.transition', p_idempotency_key,
    p_scan_session_id, v_current.revision + 1
  );
  perform set_config('graftvision.scan_controlled', 'off', true);
  return query select p_scan_session_id, v_current.revision + 1, p_new_status;
end;
$$;

create or replace function graftvision_private.pair_scan_session(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid,
  p_pairing_nonce text, p_idempotency_key text
)
returns table (scan_session_id uuid, revision integer, status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing_idempotency public.scan_operation_idempotency%rowtype;
  v_current public.scan_session%rowtype;
begin
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';
  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'CLINICAL-PERM-002') then
    raise exception using errcode = '42501', message = 'INSUFFICIENT_CLINICAL_PERMISSION';
  end if;
  select * into v_existing_idempotency from public.scan_operation_idempotency
  where clinic_id = v_clinic_id and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.pair' and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing_idempotency.scan_session_id,
      v_existing_idempotency.result_revision, 'paired'::text;
    return;
  end if;
  select * into strict v_current from public.scan_session
  where id = p_scan_session_id and clinic_id = v_clinic_id for update;
  if v_current.status <> 'created' then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;
  if v_current.expires_at <= clock_timestamp() then
    perform set_config('graftvision.scan_controlled', 'on', true);
    update public.scan_session as s
    set status = 'expired', updated_at = clock_timestamp(), revision = s.revision + 1
    where s.id = p_scan_session_id;
    insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
    values (p_scan_session_id, v_clinic_id, 'expired', null);
    perform set_config('graftvision.scan_controlled', 'off', true);
    raise exception using errcode = '40001', message = 'SCAN_SESSION_EXPIRED';
  end if;
  perform set_config('graftvision.scan_controlled', 'on', true);
  update public.scan_session as s
  set status = 'paired', pairing_nonce = p_pairing_nonce, paired_at = clock_timestamp(),
    updated_at = clock_timestamp(), revision = s.revision + 1
  where s.id = p_scan_session_id;
  insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
  values (p_scan_session_id, v_clinic_id, 'paired', v_actor_id);
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application
  ) values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'scan_session.pair',
    'scan_session', p_scan_session_id, 'success', p_idempotency_key::uuid, 'database'
  );
  insert into public.scan_operation_idempotency(
    clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision
  ) values (
    v_clinic_id, v_actor_id, 'scan_session.pair', p_idempotency_key,
    p_scan_session_id, v_current.revision + 1
  );
  perform set_config('graftvision.scan_controlled', 'off', true);
  return query select p_scan_session_id, v_current.revision + 1, 'paired'::text;
end;
$$;
