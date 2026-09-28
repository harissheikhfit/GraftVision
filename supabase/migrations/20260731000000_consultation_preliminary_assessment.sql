-- GraftVision migration
-- Task: CONSULT-004
-- Purpose: Add versioned synthetic-only preliminary clinical assessment.
-- Compatibility: Additive only. No roles or permissions are added or remapped.
-- Production: Real-patient use remains blocked by DOC-009 and DOC-010.

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
    'preliminary_assessment.retract'
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
    
    'preliminary_assessment'
  );
$$;

create table public.preliminary_assessment (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  current_version_id uuid,
  revision integer not null default 0 check (revision >= 0),
  review_state text not null default 'draft' check (review_state in (
    'draft', 'doctor_reviewed', 'superseded', 'retracted'
  )),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  unique (clinic_id, id),
  unique (clinic_id, consultation_id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.preliminary_assessment_version (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  assessment_id uuid not null,
  consultation_id uuid not null,
  version integer not null check (version > 0),
  supersedes_version_id uuid,
  
  -- Bindings
  patient_medical_history_version_id uuid not null,
  consultation_hair_loss_history_version_id uuid not null,
  consultation_revision integer not null,

  -- Preliminary classification
  pattern_classification text check (pattern_classification is null or char_length(pattern_classification) <= 100),
  certainty_code text check (certainty_code in ('reported', 'observed', 'measured', 'documented', 'verified', 'uncertain', 'not_assessed', 'contradicted')),
  source_code text check (source_code in ('patient_reported', 'caregiver_reported', 'prior_record', 'clinician_observed', 'clinician_measured', 'device_generated', 'imported', 'system_suggested', 'unknown')),
  limited_clarification text check (limited_clarification is null or char_length(limited_clarification) <= 500),

  -- Recipient-area observations
  frontal_involvement_status text check (frontal_involvement_status in ('yes', 'no', 'uncertain', 'not_assessed')),
  temporal_involvement_status text check (temporal_involvement_status in ('yes', 'no', 'uncertain', 'not_assessed')),
  mid_scalp_involvement_status text check (mid_scalp_involvement_status in ('yes', 'no', 'uncertain', 'not_assessed')),
  crown_involvement_status text check (crown_involvement_status in ('yes', 'no', 'uncertain', 'not_assessed')),
  diffuse_involvement_status text check (diffuse_involvement_status in ('yes', 'no', 'uncertain', 'not_assessed')),
  recipient_observation_summary text check (recipient_observation_summary is null or char_length(recipient_observation_summary) <= 1500),

  -- Donor-area observations
  donor_area_concern_status text check (donor_area_concern_status in ('none_reported', 'concern_reported', 'uncertain', 'not_assessed')),
  donor_limitation_status text check (donor_limitation_status in ('none_reported', 'limitation_reported', 'uncertain', 'not_assessed')),
  previous_donor_procedure_evidence_status text check (previous_donor_procedure_evidence_status in ('none_reported', 'evidence_reported', 'uncertain', 'not_assessed')),
  donor_observation_summary text check (donor_observation_summary is null or char_length(donor_observation_summary) <= 1500),

  -- Scalp and safety
  active_scalp_symptom_concern text check (active_scalp_symptom_concern is null or char_length(active_scalp_symptom_concern) <= 500),
  visible_scalp_condition_concern text check (visible_scalp_condition_concern is null or char_length(visible_scalp_condition_concern) <= 500),
  unresolved_medical_warning_status text check (unresolved_medical_warning_status in ('none', 'unresolved', 'cleared')),
  additional_information_required_status text check (additional_information_required_status in ('none', 'required', 'cleared')),
  warning_codes text[],
  safety_observation_summary text check (safety_observation_summary is null or char_length(safety_observation_summary) <= 1500),

  -- State
  review_state text not null check (review_state in (
    'draft', 'doctor_reviewed', 'superseded', 'retracted'
  )),
  downstream_stale boolean not null default false,
  
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  
  unique (clinic_id, id),
  unique (clinic_id, assessment_id, version),
  foreign key (clinic_id, assessment_id) references public.preliminary_assessment(clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  foreign key (clinic_id, patient_medical_history_version_id) references public.patient_medical_history_version(clinic_id, id),
  foreign key (clinic_id, consultation_hair_loss_history_version_id) references public.consultation_hair_loss_history_version(clinic_id, id),
  foreign key (clinic_id, supersedes_version_id) references public.preliminary_assessment_version(clinic_id, id)
);

create table public.preliminary_assessment_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  assessment_id uuid not null,
  version_id uuid,
  action text not null,
  actor_id uuid not null references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  foreign key (clinic_id, assessment_id) references public.preliminary_assessment(clinic_id, id)
);

create function graftvision_private.save_preliminary_assessment(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  
  -- Bindings
  p_patient_medical_history_version_id uuid,
  p_consultation_hair_loss_history_version_id uuid,
  p_consultation_revision integer,

  -- Preliminary classification
  p_pattern_classification text, p_certainty_code text,
  p_source_code text, p_limited_clarification text,

  -- Recipient-area observations
  p_frontal_involvement_status text, p_temporal_involvement_status text,
  p_mid_scalp_involvement_status text, p_crown_involvement_status text,
  p_diffuse_involvement_status text, p_recipient_observation_summary text,

  -- Donor-area observations
  p_donor_area_concern_status text, p_donor_limitation_status text,
  p_previous_donor_procedure_evidence_status text, p_donor_observation_summary text,

  -- Scalp and safety
  p_active_scalp_symptom_concern text, p_visible_scalp_condition_concern text,
  p_unresolved_medical_warning_status text, p_additional_information_required_status text,
  p_warning_codes text[], p_safety_observation_summary text
)
returns table (
  outcome_code text, assessment_id uuid, version_id uuid, revision integer,
  review_state text, material_change boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.preliminary_assessment%rowtype;
  v_previous public.preliminary_assessment_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_assessment_id uuid; v_version_id uuid := gen_random_uuid(); v_material boolean := false;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  ) then raise exception using errcode = '42501', message = 'PRELIMINARY_ASSESSMENT_ACCESS_DENIED'; end if;

  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_patient_medical_history_version_id,
    p_consultation_hair_loss_history_version_id, p_consultation_revision, p_pattern_classification,
    p_certainty_code, p_source_code, coalesce(p_limited_clarification,''),
    p_frontal_involvement_status, p_temporal_involvement_status, p_mid_scalp_involvement_status,
    p_crown_involvement_status, p_diffuse_involvement_status, coalesce(p_recipient_observation_summary,''),
    p_donor_area_concern_status, p_donor_limitation_status, p_previous_donor_procedure_evidence_status,
    coalesce(p_donor_observation_summary,''), coalesce(p_active_scalp_symptom_concern,''),
    coalesce(p_visible_scalp_condition_concern,''), p_unresolved_medical_warning_status,
    p_additional_information_required_status, array_to_string(coalesce(p_warning_codes, '{}'), ','),
    coalesce(p_safety_observation_summary,'')), 'sha256'), 'hex');

  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'preliminary_assessment.save'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_resource_id, v_existing.result_version_id,
      v_existing.result_revision, v_existing.result_status, false; return;
  end if;

  select * into v_root from public.preliminary_assessment
  where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id for update;
  
  if not found then
    if p_expected_revision <> 0 then return query select 'stale_revision', null::uuid, null::uuid, 0, 'draft', false; return; end if;
    v_assessment_id := gen_random_uuid();
    insert into public.preliminary_assessment(id, clinic_id, consultation_id, updated_by)
    values(v_assessment_id, v_context.clinic_id, p_consultation_id, p_actor_id);
    v_root.revision := 0; v_root.review_state := 'draft'; v_root.current_version_id := null;
  else
    v_assessment_id := v_root.id;
    if v_root.revision <> p_expected_revision then
      return query select 'stale_revision', v_root.id, v_root.current_version_id,
        v_root.revision, v_root.review_state, false; return;
    end if;
    select * into v_previous from public.preliminary_assessment_version
      where id = v_root.current_version_id;
    
    -- In this implementation, any save is considered material, or we can check diffs.
    v_material := v_previous.pattern_classification is distinct from p_pattern_classification
      or v_previous.certainty_code is distinct from p_certainty_code
      or v_previous.source_code is distinct from p_source_code
      or v_previous.frontal_involvement_status is distinct from p_frontal_involvement_status
      or v_previous.temporal_involvement_status is distinct from p_temporal_involvement_status
      or v_previous.mid_scalp_involvement_status is distinct from p_mid_scalp_involvement_status
      or v_previous.crown_involvement_status is distinct from p_crown_involvement_status
      or v_previous.diffuse_involvement_status is distinct from p_diffuse_involvement_status
      or v_previous.donor_area_concern_status is distinct from p_donor_area_concern_status
      or v_previous.donor_limitation_status is distinct from p_donor_limitation_status
      or v_previous.previous_donor_procedure_evidence_status is distinct from p_previous_donor_procedure_evidence_status
      or v_previous.unresolved_medical_warning_status is distinct from p_unresolved_medical_warning_status
      or v_previous.additional_information_required_status is distinct from p_additional_information_required_status
      or v_previous.warning_codes is distinct from coalesce(p_warning_codes, '{}');
  end if;

  insert into public.preliminary_assessment_version (
    id, clinic_id, assessment_id, consultation_id, version, supersedes_version_id,
    patient_medical_history_version_id, consultation_hair_loss_history_version_id, consultation_revision,
    pattern_classification, certainty_code, source_code, limited_clarification,
    frontal_involvement_status, temporal_involvement_status, mid_scalp_involvement_status,
    crown_involvement_status, diffuse_involvement_status, recipient_observation_summary,
    donor_area_concern_status, donor_limitation_status, previous_donor_procedure_evidence_status,
    donor_observation_summary, active_scalp_symptom_concern, visible_scalp_condition_concern,
    unresolved_medical_warning_status, additional_information_required_status, warning_codes,
    safety_observation_summary, review_state, downstream_stale, created_by
  ) values (
    v_version_id, v_context.clinic_id, v_assessment_id, p_consultation_id, v_root.revision + 1, v_root.current_version_id,
    p_patient_medical_history_version_id, p_consultation_hair_loss_history_version_id, p_consultation_revision,
    nullif(btrim(p_pattern_classification),''), p_certainty_code, p_source_code, nullif(btrim(p_limited_clarification),''),
    p_frontal_involvement_status, p_temporal_involvement_status, p_mid_scalp_involvement_status,
    p_crown_involvement_status, p_diffuse_involvement_status, nullif(btrim(p_recipient_observation_summary),''),
    p_donor_area_concern_status, p_donor_limitation_status, p_previous_donor_procedure_evidence_status,
    nullif(btrim(p_donor_observation_summary),''), nullif(btrim(p_active_scalp_symptom_concern),''), nullif(btrim(p_visible_scalp_condition_concern),''),
    p_unresolved_medical_warning_status, p_additional_information_required_status, coalesce(p_warning_codes, '{}'),
    nullif(btrim(p_safety_observation_summary),''), 'draft', false, p_actor_id
  );

-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Root-pointer progression for immutable versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.preliminary_assessment set current_version_id = v_version_id,
    revision = v_root.revision + 1,
    review_state = 'draft',
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_assessment_id;

  insert into public.preliminary_assessment_event (
    clinic_id, assessment_id, version_id, action, actor_id
  ) values (
    v_context.clinic_id, v_assessment_id, v_version_id, 'preliminary_assessment.version_create', p_actor_id
  );

  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'preliminary_assessment.save',
    p_idempotency_key, v_payload_hash, v_assessment_id, v_version_id,
    v_root.revision + 1, 'draft'
  );

  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    'preliminary_assessment.version_create',
    'preliminary_assessment', v_assessment_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_root.revision + 1)
  );

  return query select 'success', v_assessment_id, v_version_id, v_root.revision + 1,
    'draft', v_material;
end;
$$;

revoke all on function graftvision_private.save_preliminary_assessment(
  uuid, uuid, uuid, integer, uuid, uuid, uuid, integer, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], text
) from public;

create function graftvision_private.transition_preliminary_assessment_review(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_new_state text, p_controlled_reason text default null
)
returns table (outcome_code text, revision integer, review_state text)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.preliminary_assessment%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  ) then raise exception using errcode = '42501', message = 'PRELIMINARY_ASSESSMENT_ACCESS_DENIED'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  
  if p_new_state not in ('doctor_reviewed', 'superseded', 'retracted') then
    raise exception using errcode = '22023', message = 'INVALID_TRANSITION_STATE';
  end if;

  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_new_state, coalesce(p_controlled_reason,'')), 'sha256'), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'preliminary_assessment.review'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_revision, v_existing.result_status; return;
  end if;

  select * into v_root from public.preliminary_assessment
  where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id for update;
  if not found then return query select 'not_found', 0, 'draft'; return; end if;
  if v_root.revision <> p_expected_revision then return query select 'stale_revision', v_root.revision, v_root.review_state; return; end if;

-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Review state progression for root
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change state
  update public.preliminary_assessment set review_state = p_new_state,
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_root.id;
    
-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Review state progression for current version
-- graftvision:corrective-plan Immutability triggers allow review state progression explicitly
  update public.preliminary_assessment_version set review_state = p_new_state
    where id = v_root.current_version_id;

  insert into public.preliminary_assessment_event (
    clinic_id, assessment_id, version_id, action, actor_id, metadata
  ) values (
    v_context.clinic_id, v_root.id, v_root.current_version_id, 'preliminary_assessment.' || p_new_state, p_actor_id,
    case when p_controlled_reason is not null then jsonb_build_object('reason', p_controlled_reason) else '{}'::jsonb end
  );

  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'preliminary_assessment.review',
    p_idempotency_key, v_payload_hash, v_root.id, v_root.current_version_id,
    v_root.revision, p_new_state
  );

  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    'preliminary_assessment.' || p_new_state,
    'preliminary_assessment', v_root.id, 'success', p_idempotency_key, 'database',
    case when p_controlled_reason is not null then jsonb_build_object('reason', p_controlled_reason) else '{}'::jsonb end
  );
  return query select 'success', v_root.revision, p_new_state;
end;
$$;

revoke all on function graftvision_private.transition_preliminary_assessment_review(uuid, uuid, uuid, integer, uuid, text, text) from public;

create function graftvision_private.read_preliminary_assessment(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid
)
returns table (
  assessment_id uuid, version_id uuid, revision integer, review_state text,
  patient_medical_history_version_id uuid, consultation_hair_loss_history_version_id uuid,
  consultation_revision integer, pattern_classification text, certainty_code text,
  source_code text, limited_clarification text, frontal_involvement_status text,
  temporal_involvement_status text, mid_scalp_involvement_status text,
  crown_involvement_status text, diffuse_involvement_status text,
  recipient_observation_summary text, donor_area_concern_status text,
  donor_limitation_status text, previous_donor_procedure_evidence_status text,
  donor_observation_summary text, active_scalp_symptom_concern text,
  visible_scalp_condition_concern text, unresolved_medical_warning_status text,
  additional_information_required_status text, warning_codes text[],
  safety_observation_summary text, downstream_stale boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'PRELIMINARY_ASSESSMENT_ACCESS_DENIED'; end if;
  return query
  select a.id, v.id, a.revision, a.review_state, v.patient_medical_history_version_id,
    v.consultation_hair_loss_history_version_id, v.consultation_revision,
    v.pattern_classification, v.certainty_code, v.source_code, v.limited_clarification,
    v.frontal_involvement_status, v.temporal_involvement_status, v.mid_scalp_involvement_status,
    v.crown_involvement_status, v.diffuse_involvement_status, v.recipient_observation_summary,
    v.donor_area_concern_status, v.donor_limitation_status, v.previous_donor_procedure_evidence_status,
    v.donor_observation_summary, v.active_scalp_symptom_concern, v.visible_scalp_condition_concern,
    v.unresolved_medical_warning_status, v.additional_information_required_status, v.warning_codes,
    v.safety_observation_summary, v.downstream_stale
  from public.preliminary_assessment a
  join public.preliminary_assessment_version v on v.id = a.current_version_id
  where a.clinic_id = v_context.clinic_id and a.consultation_id = p_consultation_id;
end;
$$;

revoke all on function graftvision_private.read_preliminary_assessment(uuid, uuid, uuid) from public;

alter table public.preliminary_assessment enable row level security;
alter table public.preliminary_assessment_version enable row level security;
alter table public.preliminary_assessment_event enable row level security;

create policy "Deny all public mutations on preliminary_assessment" on public.preliminary_assessment for all using (false) with check (false);
create policy "Deny all public mutations on preliminary_assessment_version" on public.preliminary_assessment_version for all using (false) with check (false);
create policy "Deny all public mutations on preliminary_assessment_event" on public.preliminary_assessment_event for all using (false) with check (false);

create trigger immutable_preliminary_assessment_version before update or delete on public.preliminary_assessment_version
for each row execute function graftvision_private.prevent_clinical_immutable_mutation();

create trigger immutable_preliminary_assessment_event before update or delete on public.preliminary_assessment_event
for each row execute function graftvision_private.prevent_clinical_immutable_mutation();

-- Trigger to mark downstream_stale on medical/hair_loss version changes
create or replace function graftvision_private.mark_preliminary_assessment_stale()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'patient_medical_history_version' then
-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Mark downstream versions stale when upstream dependencies change
-- graftvision:corrective-plan Immutability triggers allow downstream_stale to be mutated
    update public.preliminary_assessment_version pav
    set downstream_stale = true
    from public.preliminary_assessment pa
    where pa.current_version_id = pav.id
      and pa.clinic_id = new.clinic_id
      and pa.consultation_id in (
        select id from public.consultation where clinic_id = new.clinic_id and patient_id = new.patient_id
      )
      and pav.patient_medical_history_version_id != new.id
      and pav.downstream_stale = false;
  elsif tg_table_name = 'consultation_hair_loss_history_version' then
-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Mark downstream versions stale when upstream dependencies change
-- graftvision:corrective-plan Immutability triggers allow downstream_stale to be mutated
    update public.preliminary_assessment_version pav
    set downstream_stale = true
    from public.preliminary_assessment pa
    where pa.current_version_id = pav.id
      and pa.clinic_id = new.clinic_id
      and pa.consultation_id = new.consultation_id
      and pav.consultation_hair_loss_history_version_id != new.id
      and pav.downstream_stale = false;
  end if;
  return null;
end;
$$;

create trigger preliminary_assessment_stale_medical after insert on public.patient_medical_history_version
for each row execute function graftvision_private.mark_preliminary_assessment_stale();

create trigger preliminary_assessment_stale_hair after insert on public.consultation_hair_loss_history_version
for each row execute function graftvision_private.mark_preliminary_assessment_stale();

