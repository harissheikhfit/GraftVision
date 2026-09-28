-- SCAN-005B3: assigned verified Doctor quality overrides with immutable evidence.
create table public.scan_capture_quality_override_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  idempotency_key uuid not null,
  scan_session_id uuid not null references public.scan_session(id),
  asset_id uuid not null references public.scan_capture_asset(id),
  capture_step text not null,
  expected_revision integer not null,
  override_reason_code text not null,
  result_id uuid not null references public.scan_capture_quality_result(id),
  result_revision integer not null,
  primary key (clinic_id, actor_platform_user_id, idempotency_key)
);

alter table public.scan_capture_quality_override_idempotency enable row level security;
alter table public.scan_capture_quality_override_idempotency force row level security;
revoke all on public.scan_capture_quality_override_idempotency from public, anon, authenticated;
create trigger scan_capture_quality_override_idempotency_controlled
before insert or update or delete on public.scan_capture_quality_override_idempotency
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

alter table public.scan_capture_quality_result
  drop constraint scan_capture_quality_result_reason_code_check,
  add constraint scan_capture_quality_result_reason_code_check check (
    reason_code is null or reason_code in (
      'IMAGE_TOO_BLURRY', 'IMAGE_TOO_DARK', 'IMAGE_TOO_BRIGHT', 'IMAGE_TOO_SMALL',
      'INVALID_ORIENTATION', 'HEAD_OUT_OF_FRAME', 'SUBJECT_TOO_CLOSE', 'SUBJECT_TOO_FAR',
      'DUPLICATE_ANGLE_IMAGE', 'ANGLE_MISMATCH', 'ASSET_REPLACED', 'QUALITY_CHECK_FAILED',
      'ACCEPTABLE_FOR_TECHNICAL_REVIEW', 'CAPTURE_LIMITATION_ACKNOWLEDGED',
      'NO_SAFE_RETAKE_AVAILABLE', 'WORKFLOW_RECOVERY'
    )
  );

alter table public.scan_capture_quality_event
  drop constraint scan_capture_quality_event_reason_code_check,
  add constraint scan_capture_quality_event_reason_code_check check (
    reason_code is null or reason_code in (
      'IMAGE_TOO_BLURRY', 'IMAGE_TOO_DARK', 'IMAGE_TOO_BRIGHT', 'IMAGE_TOO_SMALL',
      'INVALID_ORIENTATION', 'HEAD_OUT_OF_FRAME', 'SUBJECT_TOO_CLOSE', 'SUBJECT_TOO_FAR',
      'DUPLICATE_ANGLE_IMAGE', 'ANGLE_MISMATCH', 'ASSET_REPLACED', 'QUALITY_CHECK_FAILED',
      'ACCEPTABLE_FOR_TECHNICAL_REVIEW', 'CAPTURE_LIMITATION_ACKNOWLEDGED',
      'NO_SAFE_RETAKE_AVAILABLE', 'WORKFLOW_RECOVERY'
    )
  );

create or replace function graftvision_private.is_valid_audit_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_key text;
  metadata_value jsonb;
begin
  if candidate is null
    or jsonb_typeof(candidate) <> 'object'
    or octet_length(convert_to(candidate::text, 'UTF8')) > 2048 then
    return false;
  end if;

  for metadata_key, metadata_value in
    select key, value from jsonb_each(candidate)
  loop
    case metadata_key
      when 'affected_count', 'current_revision', 'expected_revision', 'new_version', 'result_revision' then
        if jsonb_typeof(metadata_value) <> 'number'
          or metadata_value::text !~ '^[0-9]{1,7}$'
          or metadata_value::text::bigint > 1000000 then
          return false;
        end if;
      when 'changed_fields' then
        if jsonb_typeof(metadata_value) <> 'array'
          or jsonb_array_length(metadata_value) > 32
          or exists (
            select 1
            from jsonb_array_elements(metadata_value) as item(value)
            where jsonb_typeof(item.value) <> 'string'
              or item.value #>> '{}' !~ '^[a-z][a-z0-9_]{0,62}$'
          ) then
          return false;
        end if;
      when 'scan_session_id', 'asset_id' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return false;
        end if;
      when 'assigned_role', 'capture_step', 'device_label', 'error_code', 'new_status',
           'operation_code', 'outcome_code', 'override_reason_code', 'policy_decision_code',
           'previous_status', 'prior_quality_state', 'quality_state', 'removed_role',
           'reason_code', 'route_family', 'storage_object_class', 'validator_version' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

do $$
declare
  validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure)
  into validator_definition;

  if position('''scan_quality.override_recorded''' in validator_definition) = 0 then
    validator_definition := replace(
      validator_definition,
      '''scan_quality.retake_requested''',
      '''scan_quality.retake_requested'', ''scan_quality.override_recorded'''
    );
    execute validator_definition;
  end if;
end;
$$;

create function graftvision_private.override_scan_quality_result(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid,
  p_asset_id uuid,
  p_capture_step text,
  p_expected_revision integer,
  p_override_reason_code text,
  p_idempotency_key uuid
)
returns table (result_id uuid, revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_review public.scan_capture_quality_review%rowtype;
  v_current public.scan_capture_quality_current%rowtype;
  v_prior public.scan_capture_quality_result%rowtype;
  v_asset public.scan_capture_asset%rowtype;
  v_existing public.scan_capture_quality_override_idempotency%rowtype;
  v_result_id uuid;
  v_validator_version text;
begin
  select * into strict v_context
  from graftvision_private.require_scan_capture_context(
    p_session_id, p_provider_identity_id, p_scan_session_id
  );

  if not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_provider_identity_id,
    (select consultation_id from public.scan_session where id = p_scan_session_id),
    'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'SCAN_QUALITY_OVERRIDE_DENIED';
  end if;

  if p_expected_revision < 1 or p_idempotency_key is null
    or p_capture_step not in ('front', 'left_profile', 'right_profile', 'crown', 'donor_rear', 'donor_left', 'donor_right')
    or p_override_reason_code not in (
      'ACCEPTABLE_FOR_TECHNICAL_REVIEW',
      'CAPTURE_LIMITATION_ACKNOWLEDGED',
      'NO_SAFE_RETAKE_AVAILABLE',
      'WORKFLOW_RECOVERY'
    )
  then
    raise exception using errcode = '22023', message = 'SCAN_QUALITY_OVERRIDE_INVALID';
  end if;

  select * into v_existing
  from public.scan_capture_quality_override_idempotency
  where clinic_id = v_context.clinic_id
    and actor_platform_user_id = v_context.actor_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.scan_session_id <> p_scan_session_id
      or v_existing.asset_id <> p_asset_id
      or v_existing.capture_step <> p_capture_step
      or v_existing.expected_revision <> p_expected_revision
      or v_existing.override_reason_code <> p_override_reason_code
    then
      raise exception using errcode = '40001', message = 'SCAN_QUALITY_IDEMPOTENCY_MISMATCH';
    end if;

    return query select v_existing.result_id, v_existing.result_revision, false;
    return;
  end if;

  select * into strict v_asset
  from public.scan_capture_asset
  where id = p_asset_id
    and clinic_id = v_context.clinic_id
    and scan_session_id = p_scan_session_id
    and capture_step = p_capture_step
    and upload_status = 'uploaded';

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled review lock serializes Doctor override revision checks.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
  select * into strict v_review
  from public.scan_capture_quality_review
  where scan_session_id = p_scan_session_id
    and clinic_id = v_context.clinic_id
  for update;

  if v_review.revision <> p_expected_revision
    or v_review.patient_id <> v_asset.patient_id
    or v_review.consultation_id <> v_asset.consultation_id
  then
    raise exception using errcode = '40001', message = 'SCAN_QUALITY_CONFLICT';
  end if;

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled current-pointer lock preserves one authoritative quality result per capture angle.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
  select * into strict v_current
  from public.scan_capture_quality_current
  where review_id = v_review.id
    and scan_session_id = p_scan_session_id
    and capture_step = p_capture_step
  for update;

  if v_current.asset_id <> p_asset_id then
    raise exception using errcode = '40001', message = 'SCAN_QUALITY_STALE_ASSET';
  end if;

  select * into strict v_prior
  from public.scan_capture_quality_result
  where id = v_current.current_result_id
    and clinic_id = v_context.clinic_id
    and patient_id = v_review.patient_id
    and consultation_id = v_review.consultation_id
    and scan_session_id = p_scan_session_id
    and asset_id = p_asset_id
    and capture_step = p_capture_step;

  if v_prior.quality_state not in ('warning', 'retake_required')
    or v_prior.reason_code in (
      'IMAGE_TOO_SMALL',
      'INVALID_ORIENTATION',
      'DUPLICATE_ANGLE_IMAGE',
      'ANGLE_MISMATCH',
      'ASSET_REPLACED'
    )
    or v_prior.asset_revision <> v_asset.capture_revision
  then
    raise exception using errcode = '42501', message = 'SCAN_QUALITY_OVERRIDE_DENIED';
  end if;

  v_validator_version := left(v_prior.validator_version, 46)
    || '.override.' || v_review.revision::text;

  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.scan_capture_quality_result (
    review_id, clinic_id, patient_id, consultation_id, scan_session_id, asset_id,
    capture_step, asset_revision, validator_version, quality_state, reason_code, created_by
  ) values (
    v_review.id, v_context.clinic_id, v_review.patient_id, v_review.consultation_id,
    p_scan_session_id, p_asset_id, p_capture_step, v_prior.asset_revision,
    v_validator_version, 'doctor_overridden', p_override_reason_code, v_context.actor_id
  ) returning id into v_result_id;

  insert into public.scan_capture_quality_event (
    review_id, quality_result_id, clinic_id, event_type, actor_platform_user_id, reason_code
  ) values (
    v_review.id, v_result_id, v_context.clinic_id, 'doctor_overridden',
    v_context.actor_id, p_override_reason_code
  );

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled pointer and review revision updates follow immutable Doctor override evidence.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable results and events remain preserved.
  update public.scan_capture_quality_current
  set prior_result_id = current_result_id,
      current_result_id = v_result_id,
      revision = revision + 1,
      updated_at = clock_timestamp()
  where review_id = v_review.id
    and capture_step = p_capture_step;

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled review revision increment completes the append-only Doctor override transition.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable results and events remain preserved.
  update public.scan_capture_quality_review
  set revision = revision + 1
  where id = v_review.id;

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, v_context.actor_id, 'user',
    'scan_quality.override_recorded', 'scan_capture_quality_result', v_result_id,
    'success', p_idempotency_key, 'database', jsonb_build_object(
      'scan_session_id', p_scan_session_id,
      'asset_id', p_asset_id,
      'capture_step', p_capture_step,
      'prior_quality_state', v_prior.quality_state,
      'override_reason_code', p_override_reason_code,
      'result_revision', v_review.revision + 1
    )
  );

  insert into public.scan_capture_quality_override_idempotency (
    clinic_id, actor_platform_user_id, idempotency_key, scan_session_id, asset_id,
    capture_step, expected_revision, override_reason_code, result_id, result_revision
  ) values (
    v_context.clinic_id, v_context.actor_id, p_idempotency_key, p_scan_session_id,
    p_asset_id, p_capture_step, p_expected_revision, p_override_reason_code,
    v_result_id, v_review.revision + 1
  );

  return query select v_result_id, v_review.revision + 1, true;
end;
$$;

revoke all on function graftvision_private.override_scan_quality_result(
  uuid, uuid, uuid, uuid, text, integer, text, uuid
) from public, anon, authenticated;
