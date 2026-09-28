-- GraftVision migration
-- Task: CONSULT-006
-- Purpose: Implement consultation completion, controlled reopen, and analyzer-readiness handoff.
-- Created UTC: 20260731000001
-- graftvision:dangerous-sql-approved task=CONSULT-006
-- graftvision:dangerous-sql-reason Reviewed immutable lifecycle events, exact bindings, strict Doctor authority predicates, and projection safety.
-- graftvision:corrective-plan Forward-fix with a later additive migration.

create table public.consultation_lifecycle_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  consultation_id uuid not null,
  event_type text not null check (event_type in ('completed', 'reopened')),
  consultation_revision integer not null check (consultation_revision > 0),
  
  -- Present only if completed
  medical_history_version_id uuid,
  hair_loss_history_version_id uuid,
  preliminary_assessment_version_id uuid,
  
  -- Present only if reopened
  reopen_reason_code text check (reopen_reason_code in (
    'PATIENT_INFORMATION_UPDATED', 'CLINICAL_HISTORY_UPDATED',
    'ASSESSMENT_REVISION_REQUIRED', 'CLERICAL_CORRECTION',
    'NEW_RELEVANT_INFORMATION', 'WORKFLOW_RECOVERY'
  )),
  
  actor_platform_user_id uuid not null references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp(),
  request_id uuid not null,
  
  unique (clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  foreign key (clinic_id, medical_history_version_id) references public.patient_medical_history_version(clinic_id, id),
  foreign key (clinic_id, hair_loss_history_version_id) references public.consultation_hair_loss_history_version(clinic_id, id),
  foreign key (clinic_id, preliminary_assessment_version_id) references public.preliminary_assessment_version(clinic_id, id),
  
  check (
    (event_type = 'completed' and 
     medical_history_version_id is not null and 
     hair_loss_history_version_id is not null and 
     preliminary_assessment_version_id is not null and 
     reopen_reason_code is null)
    or
    (event_type = 'reopened' and 
     medical_history_version_id is null and 
     hair_loss_history_version_id is null and 
     preliminary_assessment_version_id is null and 
     reopen_reason_code is not null)
  )
);

create index consultation_lifecycle_event_idx
  on public.consultation_lifecycle_event(clinic_id, consultation_id, consultation_revision desc);

alter table public.consultation_lifecycle_event enable row level security;
alter table public.consultation_lifecycle_event force row level security;

revoke all on table public.consultation_lifecycle_event from public, anon, authenticated;

create trigger consultation_lifecycle_event_controlled
before insert on public.consultation_lifecycle_event
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();

create trigger consultation_lifecycle_event_immutable
before update or delete on public.consultation_lifecycle_event
for each row execute function graftvision_private.prevent_consultation_history_mutation();

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
    'clinical_history.supersede', 'clinical_history.retract',
    'doctor_private_note.create', 'doctor_private_note.amend',
    'doctor_private_note.retract', 'doctor_private_note.sensitive_read',
    'doctor.verification.expired', 'doctor.verification.pending',
    'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create',
    'membership.deactivate', 'membership.read', 'membership.reactivate',
    'membership.role_assign', 'membership.role_remove', 'membership.suspend',
    'patient.archive', 'patient.create', 'patient.duplicate_override',
    'patient.duplicate_warning', 'patient.privacy_acknowledge',
    'patient.privacy_withdraw', 'patient.registration_create', 'patient.restore',
    'patient.status_change', 'platform.admin', 'role.assign', 'role.remove',
    'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock',
    'session.logout_after_lock', 'session.reauthentication_failed',
    'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other',
    'session.revoke_others', 'session.unlock', 'storage_key.validate',
    'system.migration', 'user.deactivate', 'user.reactivate',
    
    'preliminary_assessment.version_create',
    'preliminary_assessment.doctor_review',
    'preliminary_assessment.supersede',
    'preliminary_assessment.retract',
    
    'consultation.complete', 'consultation.reopen'
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
    'preliminary_assessment', 'consultation_lifecycle_event'
  );
$$;

create function graftvision_private.complete_consultation(
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
  
  v_payload_hash := encode(digest(p_consultation_id::text, 'sha256'), 'hex');

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

  -- The history root pointers and review_state were already checked above.

  perform set_config('graftvision.consultation_controlled', 'on', true);

  update public.consultation set
    status = 'completed',
    revision = revision + 1,
    updated_at = clock_timestamp(),
    updated_by = p_actor_id
  where id = p_consultation_id
  returning revision into v_consultation.revision;
  
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
    clinic_id, aggregate_id, actor_platform_user_id, request_family,
    idempotency_key, payload_hash, result_status, result_revision
  ) values (
    v_context.clinic_id, p_consultation_id, p_actor_id, 'consultation.complete',
    p_idempotency_key, v_payload_hash, 
    jsonb_build_object(
      'medical_history_version_id', v_med_hist.current_version_id,
      'hair_loss_history_version_id', v_hair_hist.current_version_id,
      'preliminary_assessment_version_id', v_assessment.current_version_id
    ), 
    v_consultation.revision
  );

  perform graftvision_private.emit_audit_event(
    p_session_id, p_actor_id, v_context.clinic_id,
    'consultation.complete', 'consultation_lifecycle_event', p_consultation_id,
    jsonb_build_object('consultation_id', p_consultation_id, 'revision', v_consultation.revision)
  );

  return query select 'success', v_consultation.revision, v_med_hist.current_version_id, v_hair_hist.current_version_id, v_assessment.current_version_id;
end;
$$;

create function graftvision_private.reopen_consultation(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_reopen_reason_code text
)
returns table (
  outcome_code text,
  revision integer
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_consultation public.consultation%rowtype;
  v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  ) then raise exception using errcode = '42501', message = 'CONSULTATION_ACCESS_DENIED'; end if;

  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  if p_reopen_reason_code is null then raise exception using errcode = '22023', message = 'REOPEN_REASON_REQUIRED'; end if;
  
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_reopen_reason_code), 'sha256'), 'hex');

  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'consultation.reopen'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_revision; 
    return;
  end if;

  select * into v_consultation from public.consultation
  where clinic_id = v_context.clinic_id and id = p_consultation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CONSULTATION_NOT_FOUND'; end if;

  if v_consultation.revision <> p_expected_revision then
    return query select 'stale_revision', v_consultation.revision; return;
  end if;
  
  if v_consultation.status <> 'completed' then
    return query select 'INVALID_TRANSITION', v_consultation.revision; return;
  end if;

  -- Ensure the latest lifecycle event is indeed 'completed'
  -- Reopening requires it to be already completed and not already reopened
  if not exists (
    select 1 from public.consultation_lifecycle_event
    where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id
    order by consultation_revision desc limit 1
  ) then
    return query select 'INVALID_TRANSITION', v_consultation.revision; return;
  end if;
  
  if (
    select event_type from public.consultation_lifecycle_event
    where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id
    order by consultation_revision desc limit 1
  ) <> 'completed' then
    return query select 'INVALID_TRANSITION', v_consultation.revision; return;
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);

  update public.consultation set
    status = 'in_progress',
    revision = revision + 1,
    updated_at = clock_timestamp(),
    updated_by = p_actor_id
  where id = p_consultation_id
  returning revision into v_consultation.revision;
  
  insert into public.consultation_lifecycle_event (
    clinic_id, consultation_id, event_type, consultation_revision,
    reopen_reason_code, actor_platform_user_id, request_id
  ) values (
    v_context.clinic_id, p_consultation_id, 'reopened', v_consultation.revision,
    p_reopen_reason_code, p_actor_id, p_session_id
  );

  insert into public.clinical_operation_idempotency (
    clinic_id, aggregate_id, actor_platform_user_id, request_family,
    idempotency_key, payload_hash, result_status, result_revision
  ) values (
    v_context.clinic_id, p_consultation_id, p_actor_id, 'consultation.reopen',
    p_idempotency_key, v_payload_hash, 'success'::jsonb, v_consultation.revision
  );

  perform graftvision_private.emit_audit_event(
    p_session_id, p_actor_id, v_context.clinic_id,
    'consultation.reopen', 'consultation_lifecycle_event', p_consultation_id,
    jsonb_build_object('consultation_id', p_consultation_id, 'revision', v_consultation.revision)
  );

  return query select 'success', v_consultation.revision;
end;
$$;

create view public.consultation_analyzer_readiness_projection as
select
  c.clinic_id,
  c.id as consultation_id,
  c.status = 'completed' and 
    cle.event_type = 'completed' and
    mh.current_version_id = cle.medical_history_version_id and mh.review_state = 'doctor_reviewed' and
    hh.current_version_id = cle.hair_loss_history_version_id and hh.review_state = 'doctor_reviewed' and
    pa.current_version_id = cle.preliminary_assessment_version_id and pa.review_state = 'doctor_reviewed' and
    pav.downstream_stale = false
  as is_ready,
  case when cle.event_type = 'completed' then cle.occurred_at else null end as last_completed_at
from public.consultation c
left join lateral (
  select * from public.consultation_lifecycle_event
  where clinic_id = c.clinic_id and consultation_id = c.id
  order by consultation_revision desc limit 1
) cle on true
left join public.patient_medical_history mh on mh.clinic_id = c.clinic_id and mh.patient_id = c.patient_id
left join public.consultation_hair_loss_history hh on hh.clinic_id = c.clinic_id and hh.consultation_id = c.id
left join public.preliminary_assessment pa on pa.clinic_id = c.clinic_id and pa.consultation_id = c.id
left join public.preliminary_assessment_version pav on pav.id = pa.current_version_id;

revoke all on public.consultation_analyzer_readiness_projection from public, anon, authenticated;

create function graftvision_private.read_consultation_analyzer_readiness(p_clinic_id uuid, p_consultation_id uuid)
returns table (
  is_ready boolean,
  last_completed_at timestamptz
)
language sql security definer set search_path = '' as $$
  select is_ready, last_completed_at
  from public.consultation_analyzer_readiness_projection
  where clinic_id = p_clinic_id and consultation_id = p_consultation_id;
$$;

create view public.consultation_lifecycle_event_safe_projection as
select
  e.clinic_id,
  e.consultation_id,
  e.event_type,
  e.consultation_revision,
  e.occurred_at
from public.consultation_lifecycle_event e;

revoke all on public.consultation_lifecycle_event_safe_projection from public, anon, authenticated;

create view public.consultation_lifecycle_event_clinical_projection as
select
  e.clinic_id,
  e.consultation_id,
  e.event_type,
  e.consultation_revision,
  e.medical_history_version_id,
  e.hair_loss_history_version_id,
  e.preliminary_assessment_version_id,
  e.reopen_reason_code,
  e.actor_platform_user_id,
  e.occurred_at
from public.consultation_lifecycle_event e;

revoke all on public.consultation_lifecycle_event_clinical_projection from public, anon, authenticated;

create function graftvision_private.read_lifecycle_events(
  p_session_id uuid, p_actor_id uuid, p_clinic_id uuid, p_consultation_id uuid
)
returns setof public.consultation_lifecycle_event_safe_projection
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from graftvision_private.active_clinic_membership(p_session_id, p_actor_id, p_clinic_id)
  ) then raise exception using errcode = '42501', message = 'NOT_IN_CLINIC'; end if;
  
  return query select * from public.consultation_lifecycle_event_safe_projection
  where clinic_id = p_clinic_id and consultation_id = p_consultation_id
  order by consultation_revision asc;
end;
$$;

create function graftvision_private.read_lifecycle_events_clinical(
  p_session_id uuid, p_actor_id uuid, p_clinic_id uuid, p_consultation_id uuid
)
returns setof public.consultation_lifecycle_event_clinical_projection
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from graftvision_private.clinical_context(p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001')
  ) then raise exception using errcode = '42501', message = 'ACCESS_DENIED'; end if;
  
  return query select * from public.consultation_lifecycle_event_clinical_projection
  where clinic_id = p_clinic_id and consultation_id = p_consultation_id
  order by consultation_revision asc;
end;
$$;
