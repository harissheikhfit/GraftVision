-- SCAN-005C: deterministic, non-medical capture quality invalidation.
create function graftvision_private.invalidate_scan_quality_for_replaced_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.scan_capture_quality_review%rowtype;
  v_result_id uuid;
begin
  if old.upload_status <> 'uploaded' or new.upload_status <> 'superseded' then
    return new;
  end if;

  select * into v_review
  from public.scan_capture_quality_review
  where scan_session_id = old.scan_session_id and clinic_id = old.clinic_id
  for update;
  if not found then
    return new;
  end if;

  insert into public.scan_capture_quality_result (
    review_id, clinic_id, patient_id, consultation_id, scan_session_id, asset_id,
    capture_step, asset_revision, validator_version, quality_state, reason_code, created_by
  ) values (
    v_review.id, old.clinic_id, old.patient_id, old.consultation_id, old.scan_session_id, old.id,
    old.capture_step, old.capture_revision, 'asset-replaced.v1', 'invalidated', 'ASSET_REPLACED', old.created_by
  ) returning id into v_result_id;

  insert into public.scan_capture_quality_event (
    review_id, quality_result_id, clinic_id, event_type, actor_platform_user_id, reason_code
  ) values (
    v_review.id, v_result_id, old.clinic_id, 'invalidated', old.created_by, 'ASSET_REPLACED'
  );

  insert into public.scan_capture_quality_current (
    review_id, clinic_id, patient_id, consultation_id, scan_session_id,
    capture_step, asset_id, current_result_id, revision
  ) values (
    v_review.id, old.clinic_id, old.patient_id, old.consultation_id, old.scan_session_id,
    old.capture_step, old.id, v_result_id, v_review.revision
  ) on conflict (review_id, capture_step) do update set
    prior_result_id = public.scan_capture_quality_current.current_result_id,
    asset_id = excluded.asset_id,
    current_result_id = excluded.current_result_id,
    revision = public.scan_capture_quality_current.revision + 1,
    updated_at = clock_timestamp();

-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled asset replacement invalidates only the affected current quality pointer.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
  update public.scan_capture_quality_review
  set revision = revision + 1
  where id = v_review.id;
  return new;
end;
$$;
revoke all on function graftvision_private.invalidate_scan_quality_for_replaced_asset()
  from public, anon, authenticated;

create trigger scan_capture_asset_quality_invalidation
after update of upload_status on public.scan_capture_asset
for each row execute function graftvision_private.invalidate_scan_quality_for_replaced_asset();

create function graftvision_private.is_duplicate_scan_capture_checksum(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid,
  p_asset_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_asset public.scan_capture_asset%rowtype;
begin
  select * into strict v_context
  from graftvision_private.require_scan_capture_context(
    p_session_id, p_provider_identity_id, p_scan_session_id
  );
  select * into strict v_asset
  from public.scan_capture_asset
  where id = p_asset_id and scan_session_id = p_scan_session_id
    and clinic_id = v_context.clinic_id and upload_status = 'uploaded';
  return exists (
    select 1 from public.scan_capture_asset other_asset
    where other_asset.scan_session_id = p_scan_session_id
      and other_asset.clinic_id = v_context.clinic_id
      and other_asset.upload_status = 'uploaded'
      and other_asset.id <> v_asset.id
      and other_asset.capture_step <> v_asset.capture_step
      and other_asset.checksum = v_asset.checksum
  );
end;
$$;
revoke all on function graftvision_private.is_duplicate_scan_capture_checksum(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.assess_scan_technical_metrics(
  p_width integer,
  p_height integer,
  p_blur_variance numeric,
  p_brightness numeric,
  p_framing_coverage numeric,
  p_orientation integer,
  p_duplicate_checksum boolean
)
returns table (quality_state text, reason_code text)
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_width < 1 or p_height < 1 or p_blur_variance < 0 or p_brightness < 0
    or p_brightness > 255 or p_framing_coverage < 0 or p_framing_coverage > 1 then
    raise exception using errcode = '22023', message = 'SCAN_TECHNICAL_METRICS_INVALID';
  end if;
  if p_width < 1024 or p_height < 1024 then
    return query select 'retake_required'::text, 'IMAGE_TOO_SMALL'::text;
    return;
  elsif p_orientation <> 1 then
    return query select 'retake_required'::text, 'INVALID_ORIENTATION'::text;
    return;
  elsif p_duplicate_checksum then
    return query select 'retake_required'::text, 'DUPLICATE_ANGLE_IMAGE'::text;
    return;
  elsif p_blur_variance < 80 then
    return query select 'retake_required'::text, 'IMAGE_TOO_BLURRY'::text;
    return;
  elsif p_brightness < 45 then
    return query select 'retake_required'::text, 'IMAGE_TOO_DARK'::text;
    return;
  elsif p_brightness > 210 then
    return query select 'retake_required'::text, 'IMAGE_TOO_BRIGHT'::text;
    return;
  elsif p_framing_coverage < 0.08 then
    return query select 'warning'::text, 'SUBJECT_TOO_FAR'::text;
    return;
  elsif p_framing_coverage > 0.92 then
    return query select 'warning'::text, 'SUBJECT_TOO_CLOSE'::text;
    return;
  end if;
  return query select 'passed'::text, null::text;
end;
$$;
revoke all on function graftvision_private.assess_scan_technical_metrics(integer, integer, numeric, numeric, numeric, integer, boolean)
  from public, anon, authenticated;
