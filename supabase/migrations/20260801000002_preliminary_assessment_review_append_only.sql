-- Migration: 20260801000002_preliminary_assessment_review_append_only
-- Purpose: Replace direct UPDATE with append-only version creation for review state transition.

create or replace function graftvision_private.transition_preliminary_assessment_review(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_new_state text, p_controlled_reason text default null
)
returns table (outcome_code text, revision integer, review_state text)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.preliminary_assessment%rowtype;
  v_previous public.preliminary_assessment_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_new_version_id uuid := gen_random_uuid();
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

  v_payload_hash := encode(extensions.digest(concat_ws('|', p_consultation_id, p_new_state, coalesce(p_controlled_reason,''))::text, 'sha256'::text), 'hex');
  
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

  select * into v_previous from public.preliminary_assessment_version
  where id = v_root.current_version_id;

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
    v_new_version_id, v_context.clinic_id, v_root.id, p_consultation_id, v_root.revision + 1, v_root.current_version_id,
    v_previous.patient_medical_history_version_id, v_previous.consultation_hair_loss_history_version_id, v_previous.consultation_revision,
    v_previous.pattern_classification, v_previous.certainty_code, v_previous.source_code, v_previous.limited_clarification,
    v_previous.frontal_involvement_status, v_previous.temporal_involvement_status, v_previous.mid_scalp_involvement_status,
    v_previous.crown_involvement_status, v_previous.diffuse_involvement_status, v_previous.recipient_observation_summary,
    v_previous.donor_area_concern_status, v_previous.donor_limitation_status, v_previous.previous_donor_procedure_evidence_status,
    v_previous.donor_observation_summary, v_previous.active_scalp_symptom_concern, v_previous.visible_scalp_condition_concern,
    v_previous.unresolved_medical_warning_status, v_previous.additional_information_required_status, v_previous.warning_codes,
    v_previous.safety_observation_summary, p_new_state, v_previous.downstream_stale, p_actor_id
  );

-- graftvision:dangerous-sql-approved task=CONSULT-004
-- graftvision:dangerous-sql-reason Controlled root-pointer and review-state progression for immutable preliminary-assessment versions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; immutable version rows remain preserved.
  update public.preliminary_assessment set 
    revision = v_root.revision + 1, 
    review_state = p_new_state,
    current_version_id = v_new_version_id,
    updated_at = clock_timestamp(), 
    updated_by = p_actor_id 
  where id = v_root.id;
    
  insert into public.preliminary_assessment_event (
    clinic_id, assessment_id, version_id, action, actor_id, metadata
  ) values (
    v_context.clinic_id, v_root.id, v_new_version_id, 'preliminary_assessment.' || p_new_state, p_actor_id,
    case when p_controlled_reason is not null then jsonb_build_object('reason', p_controlled_reason) else '{}'::jsonb end
  );

  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'preliminary_assessment.review',
    p_idempotency_key, v_payload_hash, v_root.id, v_new_version_id,
    v_root.revision + 1, p_new_state
  );

  return query select 'success', v_root.revision + 1, p_new_state;
end;
$$;
