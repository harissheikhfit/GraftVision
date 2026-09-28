-- GraftVision migration
-- Task: Fix unqualified digest calls

create or replace function graftvision_private.save_preliminary_assessment(
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
  
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_patient_medical_history_version_id,
    p_consultation_hair_loss_history_version_id, p_consultation_revision, p_pattern_classification,
    p_certainty_code, p_source_code, coalesce(p_limited_clarification,''),
    p_frontal_involvement_status, p_temporal_involvement_status, p_mid_scalp_involvement_status,
    p_crown_involvement_status, p_diffuse_involvement_status, coalesce(p_recipient_observation_summary,''),
    p_donor_area_concern_status, p_donor_limitation_status, p_previous_donor_procedure_evidence_status,
    coalesce(p_donor_observation_summary,''), coalesce(p_active_scalp_symptom_concern,''),
    coalesce(p_visible_scalp_condition_concern,''), p_unresolved_medical_warning_status,
    p_additional_information_required_status, array_to_string(coalesce(p_warning_codes, '{}'), ','),
    coalesce(p_safety_observation_summary,'')))::text, 'sha256'::text), 'hex');

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

create or replace function graftvision_private.transition_preliminary_assessment_review(
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

  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_new_state, coalesce(p_controlled_reason,'')))::text, 'sha256'::text), 'hex');
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
  
  v_payload_hash := encode(extensions.digest((p_consultation_id::text)::text, 'sha256'::text), 'hex');

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

create or replace function graftvision_private.reopen_consultation(
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
  
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_reopen_reason_code))::text, 'sha256'::text), 'hex');

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

create or replace function graftvision_private.save_patient_medical_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_medical_condition_status text, p_medical_condition_clarification text,
  p_allergy_status text, p_allergy_substance text,
  p_medication_status text, p_medication_name text,
  p_previous_operation_status text, p_anaesthesia_issue_status text,
  p_bleeding_concern_status text, p_healing_concern_status text,
  p_source_code text, p_certainty_code text, p_warning_codes text[],
  p_section_summary text
)
returns table (
  outcome_code text, history_id uuid, version_id uuid, revision integer,
  review_state text, material_change boolean, changed_fields text[]
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.patient_medical_history%rowtype;
  v_previous public.patient_medical_history_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_history_id uuid; v_version_id uuid := gen_random_uuid(); v_material boolean := false;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_ACCESS_DENIED'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_medical_condition_status,
    coalesce(p_medical_condition_clarification,''), p_allergy_status, coalesce(p_allergy_substance,''),
    p_medication_status, coalesce(p_medication_name,''), p_previous_operation_status,
    p_anaesthesia_issue_status, p_bleeding_concern_status, p_healing_concern_status,
    p_source_code, p_certainty_code, array_to_string(p_warning_codes,','), coalesce(p_section_summary,'')))::text, 'sha256'::text), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_context.patient_id and request_family = 'medical_history.save'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_resource_id, v_existing.result_version_id,
      v_existing.result_revision, v_existing.result_status, false, array[]::text[]; return;
  end if;
  select * into v_root from public.patient_medical_history
  where clinic_id = v_context.clinic_id and patient_id = v_context.patient_id for update;
  if not found then
    if p_expected_revision <> 0 then return query select 'stale_revision', null::uuid, null::uuid, 0, 'draft', false, array['medical_history']::text[]; return; end if;
    v_history_id := gen_random_uuid();
    insert into public.patient_medical_history(id, clinic_id, patient_id, updated_by)
    values(v_history_id, v_context.clinic_id, v_context.patient_id, p_actor_id);
    v_root.revision := 0; v_root.review_state := 'draft'; v_root.current_version_id := null;
  else
    v_history_id := v_root.id;
    if v_root.revision <> p_expected_revision then
      return query select 'stale_revision', v_root.id, v_root.current_version_id,
        v_root.revision, v_root.review_state, false, array['medical_history']::text[]; return;
    end if;
    select * into v_previous from public.patient_medical_history_version
      where id = v_root.current_version_id;
    v_material := v_previous.medical_condition_status is distinct from p_medical_condition_status
      or v_previous.allergy_status is distinct from p_allergy_status
      or v_previous.allergy_substance is distinct from p_allergy_substance
      or v_previous.medication_status is distinct from p_medication_status
      or v_previous.medication_name is distinct from p_medication_name
      or v_previous.previous_operation_status is distinct from p_previous_operation_status
      or v_previous.anaesthesia_issue_status is distinct from p_anaesthesia_issue_status
      or v_previous.bleeding_concern_status is distinct from p_bleeding_concern_status
      or v_previous.healing_concern_status is distinct from p_healing_concern_status
      or v_previous.source_code is distinct from p_source_code
      or v_previous.certainty_code is distinct from p_certainty_code
      or v_previous.warning_codes is distinct from p_warning_codes;
  end if;
  insert into public.patient_medical_history_version values (
    v_version_id, v_context.clinic_id, v_history_id, v_context.patient_id, v_root.revision + 1,
    v_root.current_version_id, p_medical_condition_status, nullif(btrim(p_medical_condition_clarification),''),
    p_allergy_status, nullif(btrim(p_allergy_substance),''), p_medication_status,
    nullif(btrim(p_medication_name),''), p_previous_operation_status, p_anaesthesia_issue_status,
    p_bleeding_concern_status, p_healing_concern_status, p_source_code, p_certainty_code,
    coalesce(p_warning_codes,'{}'), nullif(btrim(p_section_summary),''), v_material,
    clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for immutable versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.patient_medical_history set current_version_id = v_version_id,
    revision = v_root.revision + 1,
    review_state = case when v_material and v_root.review_state = 'doctor_reviewed'
      then 'amendment_required' else 'draft' end,
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_history_id;
  insert into public.consultation_history_binding(
    clinic_id, consultation_id, medical_history_version_id, hair_loss_history_version_id, bound_by
  )
  select v_context.clinic_id, p_consultation_id, v_version_id, h.current_version_id, p_actor_id
  from public.consultation_hair_loss_history h
  where h.clinic_id = v_context.clinic_id and h.consultation_id = p_consultation_id
  on conflict (clinic_id, consultation_id) do update
    set medical_history_version_id = excluded.medical_history_version_id,
        bound_at = clock_timestamp(), bound_by = excluded.bound_by;
  insert into public.clinical_history_change_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, 'medical_history',
    v_version_id, v_material, v_material,
    array['medical_conditions','allergies','medications','procedures','safety'],
    p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_context.patient_id, 'medical_history.save',
    p_idempotency_key, v_payload_hash, v_history_id, v_version_id,
    v_root.revision + 1, 'draft'
  );
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    case when v_material then 'clinical_history.material_amend' else 'clinical_history.version_create' end,
    'clinical_history', v_history_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_root.revision + 1,
      'changed_fields', array['medical_conditions','allergies','medications','procedures','safety'])
  );
  return query select 'success', v_history_id, v_version_id, v_root.revision + 1,
    case when v_material and v_root.review_state = 'doctor_reviewed' then 'amendment_required' else 'draft' end,
    v_material, array['medical_conditions','allergies','medications','procedures','safety']::text[];
end;
$$;

revoke all on function graftvision_private.save_patient_medical_history(
  uuid,uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text[],text
) from public, anon, authenticated;

create or replace function graftvision_private.save_consultation_hair_loss_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_primary_concern text, p_onset_kind text, p_onset_value integer,
  p_progression text, p_previous_hair_procedure_status text,
  p_pattern_classification text, p_scalp_symptom_status text,
  p_scalp_symptom_codes text[], p_patient_goal_codes text[],
  p_source_code text, p_certainty_code text, p_section_clarification text
)
returns table (
  outcome_code text, history_id uuid, version_id uuid, revision integer,
  review_state text, material_change boolean, changed_fields text[]
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.consultation_hair_loss_history%rowtype;
  v_previous public.consultation_hair_loss_history_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_history_id uuid; v_version_id uuid := gen_random_uuid(); v_material boolean := false;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_ACCESS_DENIED'; end if;
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_primary_concern,
    p_onset_kind, coalesce(p_onset_value::text,''), p_progression,
    p_previous_hair_procedure_status, p_pattern_classification, p_scalp_symptom_status,
    array_to_string(p_scalp_symptom_codes,','), array_to_string(p_patient_goal_codes,','),
    p_source_code, p_certainty_code, coalesce(p_section_clarification,'')))::text, 'sha256'::text), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'hair_loss_history.save'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_resource_id, v_existing.result_version_id,
      v_existing.result_revision, v_existing.result_status, false, array[]::text[]; return;
  end if;
  select * into v_root from public.consultation_hair_loss_history
    where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id for update;
  if not found then
    if p_expected_revision <> 0 then return query select 'stale_revision', null::uuid, null::uuid, 0, 'draft', false, array['hair_loss_history']::text[]; return; end if;
    v_history_id := gen_random_uuid();
    insert into public.consultation_hair_loss_history(
      id, clinic_id, consultation_id, updated_by
    ) values(v_history_id, v_context.clinic_id, p_consultation_id, p_actor_id);
    v_root.revision := 0; v_root.review_state := 'draft'; v_root.current_version_id := null;
  else
    v_history_id := v_root.id;
    if v_root.revision <> p_expected_revision then
      return query select 'stale_revision', v_root.id, v_root.current_version_id,
        v_root.revision, v_root.review_state, false, array['hair_loss_history']::text[]; return;
    end if;
    select * into v_previous from public.consultation_hair_loss_history_version
      where id = v_root.current_version_id;
    v_material := v_previous.primary_concern is distinct from p_primary_concern
      or v_previous.onset_kind is distinct from p_onset_kind
      or v_previous.onset_value is distinct from p_onset_value
      or v_previous.progression is distinct from p_progression
      or v_previous.previous_hair_procedure_status is distinct from p_previous_hair_procedure_status
      or v_previous.pattern_classification is distinct from p_pattern_classification
      or v_previous.scalp_symptom_status is distinct from p_scalp_symptom_status
      or v_previous.scalp_symptom_codes is distinct from p_scalp_symptom_codes
      or v_previous.patient_goal_codes is distinct from p_patient_goal_codes
      or v_previous.source_code is distinct from p_source_code
      or v_previous.certainty_code is distinct from p_certainty_code;
  end if;
  insert into public.consultation_hair_loss_history_version values (
    v_version_id, v_context.clinic_id, v_history_id, p_consultation_id,
    v_root.revision + 1, v_root.current_version_id, p_primary_concern,
    p_onset_kind, p_onset_value, p_progression, p_previous_hair_procedure_status,
    p_pattern_classification, p_scalp_symptom_status, coalesce(p_scalp_symptom_codes,'{}'),
    coalesce(p_patient_goal_codes,'{}'), p_source_code, p_certainty_code,
    nullif(btrim(p_section_clarification),''), v_material, clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for immutable versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.consultation_hair_loss_history set current_version_id = v_version_id,
    revision = v_root.revision + 1,
    review_state = case when v_material and v_root.review_state = 'doctor_reviewed'
      then 'amendment_required' else 'draft' end,
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_history_id;
  insert into public.consultation_history_binding(
    clinic_id, consultation_id, medical_history_version_id, hair_loss_history_version_id, bound_by
  )
  select v_context.clinic_id, p_consultation_id, m.current_version_id, v_version_id, p_actor_id
  from public.patient_medical_history m where m.clinic_id = v_context.clinic_id
    and m.patient_id = v_context.patient_id
  on conflict (clinic_id, consultation_id) do update
    set hair_loss_history_version_id = excluded.hair_loss_history_version_id,
        bound_at = clock_timestamp(), bound_by = excluded.bound_by;
  insert into public.clinical_history_change_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, 'hair_loss_history',
    v_version_id, v_material, v_material,
    array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals'],
    p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'hair_loss_history.save',
    p_idempotency_key, v_payload_hash, v_history_id, v_version_id,
    v_root.revision + 1, 'draft'
  );
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    case when v_material then 'clinical_history.material_amend' else 'clinical_history.version_create' end,
    'clinical_history', v_history_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_root.revision + 1,
      'changed_fields', array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals'])
  );
  return query select 'success', v_history_id, v_version_id, v_root.revision + 1,
    case when v_material and v_root.review_state = 'doctor_reviewed' then 'amendment_required' else 'draft' end,
    v_material, array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals']::text[];
end;
$$;

revoke all on function graftvision_private.save_consultation_hair_loss_history(
  uuid,uuid,uuid,integer,uuid,text,text,integer,text,text,text,text,text[],text[],text,text,text
) from public, anon, authenticated;

create or replace function graftvision_private.transition_clinical_history_review(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_aggregate_type text, p_expected_revision integer, p_new_state text,
  p_reason_code text, p_idempotency_key uuid
)
returns table (outcome_code text, revision integer, review_state text)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_root_id uuid; v_version_id uuid; v_revision integer;
  v_previous_state text; v_action text; v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id,
    case when p_new_state = 'submitted_for_review' then 'CONSULT-PERM-001' else 'CONSULT-PERM-002' end
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_REVIEW_DENIED'; end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED';
  end if;
  if p_new_state <> 'submitted_for_review'
    and not graftvision_private.is_assigned_verified_doctor(
      p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-002'
    ) then raise exception using errcode = '42501', message = 'ASSIGNED_VERIFIED_DOCTOR_REQUIRED'; end if;
  if p_aggregate_type = 'medical_history' then
    select h.id, h.current_version_id, h.revision, h.review_state
      into v_root_id, v_version_id, v_revision, v_previous_state
    from public.patient_medical_history h where h.clinic_id = v_context.clinic_id
      and h.patient_id = v_context.patient_id for update;
  elsif p_aggregate_type = 'hair_loss_history' then
    select h.id, h.current_version_id, h.revision, h.review_state
      into v_root_id, v_version_id, v_revision, v_previous_state
    from public.consultation_hair_loss_history h where h.clinic_id = v_context.clinic_id
      and h.consultation_id = p_consultation_id for update;
  else raise exception using errcode = '22023', message = 'INVALID_CLINICAL_AGGREGATE'; end if;
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, p_aggregate_type,
    p_expected_revision, p_new_state, p_reason_code))::text, 'sha256'::text), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_root_id and request_family = 'clinical_history.review'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return query select 'success', v_existing.result_revision, v_existing.result_status;
    return;
  end if;
  if v_revision <> p_expected_revision then
    return query select 'stale_revision', v_revision, v_previous_state; return;
  end if;
  if not (
    (p_new_state = 'submitted_for_review' and v_previous_state in ('draft','amendment_required'))
    or (p_new_state in ('doctor_reviewed','amendment_required') and v_previous_state = 'submitted_for_review')
    or (p_new_state = 'retracted' and v_previous_state = 'doctor_reviewed')
  ) then raise exception using errcode = '22023', message = 'INVALID_REVIEW_TRANSITION'; end if;
  if p_aggregate_type = 'medical_history' then
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Review state progression for root
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change state
    update public.patient_medical_history set review_state = p_new_state,
      revision = revision + 1, updated_at = clock_timestamp(), updated_by = p_actor_id
    where id = v_root_id;
  else
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Review state progression for root
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change state
    update public.consultation_hair_loss_history set review_state = p_new_state,
      revision = revision + 1, updated_at = clock_timestamp(), updated_by = p_actor_id
    where id = v_root_id;
  end if;
  insert into public.clinical_history_review_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, p_aggregate_type,
    v_version_id, v_previous_state, p_new_state, p_reason_code, p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_root_id, 'clinical_history.review',
    p_idempotency_key, v_payload_hash, v_root_id, v_version_id,
    v_revision + 1, p_new_state
  );
  v_action := case p_new_state when 'submitted_for_review' then 'clinical_history.submit_review'
    when 'doctor_reviewed' then 'clinical_history.doctor_review'
    when 'amendment_required' then 'clinical_history.amendment_request'
    else 'clinical_history.retract' end;
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, reason_code, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user', v_action, 'clinical_history',
    v_root_id, 'success', p_reason_code, p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_revision + 1, 'new_status', p_new_state)
  );
  return query select 'success', v_revision + 1, p_new_state;
end;
$$;

revoke all on function graftvision_private.transition_clinical_history_review(
  uuid,uuid,uuid,text,integer,text,text,uuid
) from public, anon, authenticated;

create or replace function graftvision_private.mutate_doctor_private_note(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid, p_note_id uuid,
  p_expected_revision integer, p_action text, p_note_text text,
  p_reason_code text, p_idempotency_key uuid
)
returns table (outcome_code text, note_id uuid, version_id uuid, revision integer, status text)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_note public.doctor_private_note%rowtype;
  v_note_id uuid := coalesce(p_note_id, gen_random_uuid()); v_version_id uuid := gen_random_uuid();
  v_action text; v_idempotency_aggregate uuid; v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  ) then raise exception using errcode = '42501', message = 'PRIVATE_NOTE_ACCESS_DENIED'; end if;
  if p_action not in ('create','amend','retract') then raise exception using errcode = '22023', message = 'INVALID_PRIVATE_NOTE_ACTION'; end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED';
  end if;
  v_idempotency_aggregate := coalesce(p_note_id, p_consultation_id);
  v_payload_hash := encode(extensions.digest((concat_ws('|', p_consultation_id, coalesce(p_note_id::text,''),
    p_expected_revision, p_action, coalesce(p_note_text,''), coalesce(p_reason_code,'')))::text, 'sha256'::text), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_idempotency_aggregate
    and request_family = 'doctor_private_note.' || p_action
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return query select 'success', v_existing.result_resource_id,
      v_existing.result_version_id, v_existing.result_revision, v_existing.result_status;
    return;
  end if;
  if p_action = 'create' then
    if p_note_id is not null or p_expected_revision <> 0 then raise exception using errcode = '22023', message = 'INVALID_PRIVATE_NOTE_CREATE'; end if;
    insert into public.doctor_private_note(
      id, clinic_id, consultation_id, author_platform_user_id
    ) values(v_note_id, v_context.clinic_id, p_consultation_id, p_actor_id);
    v_note.revision := 0; v_note.current_version_id := null;
  else
    select * into strict v_note from public.doctor_private_note
      where clinic_id = v_context.clinic_id and id = p_note_id
        and consultation_id = p_consultation_id for update;
    if v_note.revision <> p_expected_revision then
      return query select 'stale_revision', v_note.id, v_note.current_version_id,
        v_note.revision, v_note.status; return;
    end if;
  end if;
  if p_action = 'retract' and (p_reason_code is null or p_note_text is not null) then
    raise exception using errcode = '22023', message = 'PRIVATE_NOTE_RETRACTION_REASON_REQUIRED';
  elsif p_action <> 'retract' and (p_note_text is null or p_reason_code is not null) then
    raise exception using errcode = '22023', message = 'PRIVATE_NOTE_TEXT_REQUIRED';
  end if;
  insert into public.doctor_private_note_version values (
    v_version_id, v_context.clinic_id, v_note_id, p_consultation_id,
    v_note.revision + 1, v_note.current_version_id,
    case when p_action = 'retract' then '[retracted]' else btrim(p_note_text) end,
    case p_action when 'create' then 'created' when 'amend' then 'amended' else 'retracted' end,
    p_reason_code, clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for private note versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.doctor_private_note set current_version_id = v_version_id,
    revision = v_note.revision + 1,
    status = case when p_action = 'retract' then 'retracted' else 'active' end,
    updated_at = clock_timestamp() where id = v_note_id;
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_idempotency_aggregate,
    'doctor_private_note.' || p_action, p_idempotency_key, v_payload_hash,
    v_note_id, v_version_id, v_note.revision + 1,
    case when p_action = 'retract' then 'retracted' else 'active' end
  );
  v_action := case p_action when 'create' then 'doctor_private_note.create'
    when 'amend' then 'doctor_private_note.amend' else 'doctor_private_note.retract' end;
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, reason_code, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user', v_action, 'doctor_private_note',
    v_note_id, 'success', p_reason_code, p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_note.revision + 1)
  );
  return query select 'success', v_note_id, v_version_id, v_note.revision + 1,
    case when p_action = 'retract' then 'retracted' else 'active' end;
end;
$$;

revoke all on function graftvision_private.mutate_doctor_private_note(
  uuid,uuid,uuid,uuid,integer,text,text,text,uuid
) from public, anon, authenticated;

