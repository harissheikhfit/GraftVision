-- SCAN-005B2b: controlled append-only quality retake transition.
create table public.scan_capture_quality_retake_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  idempotency_key text not null,
  scan_session_id uuid not null references public.scan_session(id),
  asset_id uuid not null references public.scan_capture_asset(id),
  capture_step text not null,
  expected_revision integer not null,
  reason_code text not null,
  result_id uuid not null references public.scan_capture_quality_result(id),
  result_revision integer not null,
  primary key (clinic_id, actor_platform_user_id, idempotency_key)
);

alter table public.scan_capture_quality_retake_idempotency enable row level security;
alter table public.scan_capture_quality_retake_idempotency force row level security;
revoke all on public.scan_capture_quality_retake_idempotency from public, anon, authenticated;
create trigger scan_capture_quality_retake_idempotency_controlled
before insert or update or delete on public.scan_capture_quality_retake_idempotency
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.request_scan_quality_retake(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid,
  p_asset_id uuid,
  p_capture_step text,
  p_expected_revision integer,
  p_reason_code text,
  p_idempotency_key text
)
returns table (result_id uuid, revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_review public.scan_capture_quality_review%rowtype;
  v_current public.scan_capture_quality_current%rowtype;
  v_prior public.scan_capture_quality_result%rowtype;
  v_asset public.scan_capture_asset%rowtype;
  v_existing public.scan_capture_quality_retake_idempotency%rowtype;
  v_result_id uuid;
  v_validator_version text;
begin
  select * into strict v_context
  from graftvision_private.require_scan_capture_context(
    p_session_id, p_provider_identity_id, p_scan_session_id
  );

  if p_expected_revision < 1 or p_idempotency_key is null or btrim(p_idempotency_key) = ''
    or p_capture_step not in ('front', 'left_profile', 'right_profile', 'crown', 'donor_rear', 'donor_left', 'donor_right')
    or p_reason_code not in ('IMAGE_TOO_BLURRY', 'IMAGE_TOO_DARK', 'IMAGE_TOO_BRIGHT', 'IMAGE_TOO_SMALL', 'INVALID_ORIENTATION', 'HEAD_OUT_OF_FRAME', 'SUBJECT_TOO_CLOSE', 'SUBJECT_TOO_FAR', 'DUPLICATE_ANGLE_IMAGE', 'ANGLE_MISMATCH', 'ASSET_REPLACED', 'QUALITY_CHECK_FAILED')
  then
    raise exception using errcode = '22023', message = 'SCAN_QUALITY_INVALID';
  end if;

  select * into v_existing
  from public.scan_capture_quality_retake_idempotency
  where clinic_id = v_context.clinic_id
    and actor_platform_user_id = v_context.actor_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.scan_session_id <> p_scan_session_id
      or v_existing.asset_id <> p_asset_id
      or v_existing.capture_step <> p_capture_step
      or v_existing.expected_revision <> p_expected_revision
      or v_existing.reason_code <> p_reason_code
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
-- graftvision:dangerous-sql-reason Controlled review lock serializes retake revision checks.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
  select * into strict v_review
  from public.scan_capture_quality_review
  where scan_session_id = p_scan_session_id
    and clinic_id = v_context.clinic_id
  for update;

  if v_review.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'SCAN_QUALITY_CONFLICT';
  end if;

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled current-pointer lock preserves one authoritative quality result per capture angle.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
  select * into v_current
  from public.scan_capture_quality_current
  where scan_session_id = p_scan_session_id
    and capture_step = p_capture_step
  for update;

  if not found then
    select * into strict v_prior
    from public.scan_capture_quality_result
    where review_id = v_review.id
      and clinic_id = v_context.clinic_id
      and scan_session_id = p_scan_session_id
      and asset_id = p_asset_id
      and capture_step = p_capture_step
      and quality_state <> 'invalidated'
    order by created_at desc, id desc
    limit 1;

    perform set_config('graftvision.scan_controlled', 'on', true);
    insert into public.scan_capture_quality_current (
      review_id, clinic_id, patient_id, consultation_id, scan_session_id,
      capture_step, asset_id, current_result_id, revision
    ) values (
      v_review.id, v_context.clinic_id, v_review.patient_id, v_review.consultation_id,
      p_scan_session_id, p_capture_step, p_asset_id, v_prior.id, v_review.revision
    ) returning * into v_current;
  elsif v_current.asset_id <> p_asset_id then
    raise exception using errcode = '40001', message = 'SCAN_QUALITY_STALE_ASSET';
  else
    select * into strict v_prior
    from public.scan_capture_quality_result
    where id = v_current.current_result_id
      and asset_id = p_asset_id
      and quality_state <> 'invalidated';
  end if;

  if v_prior.clinic_id <> v_context.clinic_id
    or v_prior.patient_id <> v_review.patient_id
    or v_prior.consultation_id <> v_review.consultation_id
    or v_prior.scan_session_id <> p_scan_session_id
    or v_prior.capture_step <> p_capture_step
    or v_prior.asset_revision <> v_asset.capture_revision
  then
    raise exception using errcode = '40001', message = 'SCAN_QUALITY_STALE_ASSET';
  end if;

  v_validator_version := left(v_prior.validator_version, 48)
    || '.retake.' || v_review.revision::text;

  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.scan_capture_quality_result (
    review_id, clinic_id, patient_id, consultation_id, scan_session_id, asset_id,
    capture_step, asset_revision, validator_version, quality_state, reason_code, created_by
  ) values (
    v_review.id, v_context.clinic_id, v_review.patient_id, v_review.consultation_id,
    p_scan_session_id, p_asset_id, p_capture_step, v_prior.asset_revision,
    v_validator_version, 'retake_required', p_reason_code, v_context.actor_id
  ) returning id into v_result_id;

  insert into public.scan_capture_quality_event (
    review_id, quality_result_id, clinic_id, event_type, actor_platform_user_id, reason_code
  ) values (
    v_review.id, v_result_id, v_context.clinic_id, 'retake_requested',
    v_context.actor_id, p_reason_code
  );

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled pointer and review revision updates follow append-only retake evidence.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable results and events remain preserved.
  update public.scan_capture_quality_current
  set prior_result_id = current_result_id,
      current_result_id = v_result_id,
      revision = revision + 1,
      updated_at = clock_timestamp()
  where review_id = v_review.id
    and capture_step = p_capture_step;

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled review revision increment completes the append-only retake transition.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable results and events remain preserved.
  update public.scan_capture_quality_review
  set revision = revision + 1
  where id = v_review.id;

  insert into public.scan_capture_quality_retake_idempotency (
    clinic_id, actor_platform_user_id, idempotency_key, scan_session_id, asset_id,
    capture_step, expected_revision, reason_code, result_id, result_revision
  ) values (
    v_context.clinic_id, v_context.actor_id, p_idempotency_key, p_scan_session_id,
    p_asset_id, p_capture_step, p_expected_revision, p_reason_code, v_result_id,
    v_review.revision + 1
  );

  return query select v_result_id, v_review.revision + 1, true;
end;
$$;

revoke all on function graftvision_private.request_scan_quality_retake(uuid, uuid, uuid, uuid, text, integer, text, text) from public, anon, authenticated;

create or replace function graftvision_private.read_scan_package_readiness(p_scan_session_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.scan_session ss
    where ss.id = p_scan_session_id and ss.status = 'completed'
  )
  and 7 = (
    select count(*) from public.scan_capture_asset a
    where a.scan_session_id = p_scan_session_id and a.upload_status = 'uploaded'
  )
  and 7 = (
    select count(distinct r.capture_step)
    from public.scan_capture_quality_result r
    join public.scan_capture_asset a on a.id = r.asset_id
    where r.scan_session_id = p_scan_session_id
      and a.upload_status = 'uploaded'
      and r.quality_state in ('passed', 'doctor_overridden')
  )
  and not exists (
    select 1
    from public.scan_capture_quality_current qc
    join public.scan_capture_quality_result r on r.id = qc.current_result_id
    where qc.scan_session_id = p_scan_session_id
      and r.quality_state = 'retake_required'
  );
$$;
revoke all on function graftvision_private.read_scan_package_readiness(uuid) from public, anon, authenticated;
