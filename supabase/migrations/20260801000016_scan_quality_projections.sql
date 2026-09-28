-- SCAN-005B4: trusted current quality matrix and package readiness projections.
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled current-pointer synchronization keeps projections aligned with immutable quality results.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable quality evidence remains preserved.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.save_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,text)'::regprocedure
  ) into function_definition;

  if position('scan_capture_quality_current' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      ' update public.scan_capture_quality_review set revision=revision+1 where id=r.id;',
      $pointer$ insert into public.scan_capture_quality_current (
        review_id, clinic_id, patient_id, consultation_id, scan_session_id,
        capture_step, asset_id, current_result_id, revision
      ) values (
        r.id, c.clinic_id, ss.patient_id, ss.consultation_id, p_scan_session_id,
        p_capture_step, p_asset_id, nid, r.revision
      ) on conflict (review_id, capture_step) do update set
        prior_result_id = public.scan_capture_quality_current.current_result_id,
        asset_id = excluded.asset_id,
        current_result_id = excluded.current_result_id,
        revision = public.scan_capture_quality_current.revision + 1,
        updated_at = clock_timestamp();
 update public.scan_capture_quality_review set revision=revision+1 where id=r.id;$pointer$
    );
    execute function_definition;
  end if;
end;
$$;

create or replace function graftvision_private.read_scan_quality_matrix(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid
)
returns table (
  capture_step text,
  asset_id uuid,
  quality_result_id uuid,
  quality_state text,
  reason_code text,
  validator_version text,
  quality_revision integer,
  validated_at timestamptz,
  retake_requested boolean,
  doctor_overridden boolean,
  stale boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
begin
  select * into strict v_context
  from graftvision_private.require_scan_capture_context(
    p_session_id, p_provider_identity_id, p_scan_session_id
  );

  return query
  with required_steps(capture_step) as (
    values ('front'::text), ('left_profile'), ('right_profile'), ('crown'),
      ('donor_rear'), ('donor_left'), ('donor_right')
  )
  select
    required_steps.capture_step,
    qc.asset_id,
    qc.current_result_id,
    qr.quality_state,
    qr.reason_code,
    qr.validator_version,
    qc.revision,
    qr.created_at,
    coalesce(qr.quality_state = 'retake_required', false),
    coalesce(qr.quality_state = 'doctor_overridden', false),
    qc.review_id is not null and (
      asset.id is null
      or asset.upload_status <> 'uploaded'
      or qr.id is null
      or qr.asset_id <> qc.asset_id
      or qr.capture_step <> qc.capture_step
      or qr.asset_revision <> asset.capture_revision
      or qr.scan_session_id <> p_scan_session_id
      or qr.clinic_id <> v_context.clinic_id
    )
  from required_steps
  left join public.scan_capture_quality_current qc
    on qc.scan_session_id = p_scan_session_id
    and qc.clinic_id = v_context.clinic_id
    and qc.capture_step = required_steps.capture_step
  left join public.scan_capture_quality_result qr on qr.id = qc.current_result_id
  left join public.scan_capture_asset asset on asset.id = qc.asset_id
  order by array_position(
    array['front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right'],
    required_steps.capture_step
  );
end;
$$;
revoke all on function graftvision_private.read_scan_quality_matrix(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function graftvision_private.read_scan_package_readiness(
  p_scan_session_id uuid
)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1
    from public.scan_session ss
    join public.consultation c on c.id = ss.consultation_id and c.clinic_id = ss.clinic_id
    join graftvision_private.read_consultation_analyzer_readiness(ss.clinic_id, ss.consultation_id) analyzer
      on analyzer.is_ready
    where ss.id = p_scan_session_id
      and ss.status = 'completed'
      and ss.expires_at > clock_timestamp()
      and 7 = (
        select count(*)
        from public.scan_capture_quality_current qc
        join public.scan_capture_asset asset on asset.id = qc.asset_id
        join public.scan_capture_quality_result qr on qr.id = qc.current_result_id
        where qc.scan_session_id = ss.id
          and qc.clinic_id = ss.clinic_id
          and asset.scan_session_id = ss.id
          and asset.consultation_id = ss.consultation_id
          and asset.patient_id = ss.patient_id
          and asset.upload_status = 'uploaded'
          and qr.review_id = qc.review_id
          and qr.asset_id = qc.asset_id
          and qr.scan_session_id = ss.id
          and qr.consultation_id = ss.consultation_id
          and qr.patient_id = ss.patient_id
          and qr.capture_step = qc.capture_step
          and qr.asset_revision = asset.capture_revision
          and qr.quality_state in ('passed', 'doctor_overridden')
          and coalesce(qr.reason_code, '') not in (
            'IMAGE_TOO_SMALL', 'INVALID_ORIENTATION', 'DUPLICATE_ANGLE_IMAGE',
            'ANGLE_MISMATCH', 'ASSET_REPLACED'
          )
      )
  );
$$;
revoke all on function graftvision_private.read_scan_package_readiness(uuid)
  from public, anon, authenticated;

create function graftvision_private.read_scan_package_readiness(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid
)
returns table (
  is_ready boolean,
  quality_review_revision integer,
  required_angle_count integer,
  ready_angle_count integer,
  blocker_codes text[],
  evaluated_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_session public.scan_session%rowtype;
  v_review public.scan_capture_quality_review%rowtype;
  v_blockers text[] := '{}'::text[];
  v_ready_angles integer := 0;
  v_step record;
  v_analyzer_ready boolean := false;
begin
  select * into strict v_context
  from graftvision_private.require_scan_capture_context(
    p_session_id, p_provider_identity_id, p_scan_session_id
  );
  select * into strict v_session
  from public.scan_session
  where id = p_scan_session_id and clinic_id = v_context.clinic_id;
  select * into v_review
  from public.scan_capture_quality_review
  where scan_session_id = p_scan_session_id and clinic_id = v_context.clinic_id;
  select is_ready into v_analyzer_ready
  from graftvision_private.read_consultation_analyzer_readiness(
    v_context.clinic_id, v_session.consultation_id
  );

  if v_session.status <> 'completed' or v_session.expires_at <= clock_timestamp() then
    v_blockers := array_append(v_blockers, 'SESSION_NOT_ELIGIBLE');
  end if;
  if not coalesce(v_analyzer_ready, false) then
    v_blockers := array_append(v_blockers, 'CONSULTATION_NOT_ANALYZER_READY');
  end if;

  for v_step in
    select * from graftvision_private.read_scan_quality_matrix(
      p_session_id, p_provider_identity_id, p_scan_session_id
    )
  loop
    if v_step.asset_id is null then
      v_blockers := array_append(v_blockers, 'MISSING_REQUIRED_ASSET');
    end if;
    if v_step.quality_result_id is null then
      v_blockers := array_append(v_blockers, 'MISSING_QUALITY_RESULT');
      continue;
    end if;
    if v_step.stale then
      v_blockers := array_append(v_blockers, 'STALE_QUALITY_RESULT');
      continue;
    end if;
    if v_step.quality_state = 'pending' then
      v_blockers := array_append(v_blockers, 'QUALITY_PENDING');
    elsif v_step.quality_state = 'warning' then
      v_blockers := array_append(v_blockers, 'QUALITY_WARNING');
    elsif v_step.quality_state = 'retake_required' then
      v_blockers := array_append(v_blockers, 'RETAKE_REQUIRED');
    elsif v_step.quality_state = 'invalidated' then
      v_blockers := array_append(v_blockers, 'QUALITY_INVALIDATED');
    elsif v_step.quality_state in ('passed', 'doctor_overridden')
      and coalesce(v_step.reason_code, '') not in (
        'IMAGE_TOO_SMALL', 'INVALID_ORIENTATION', 'DUPLICATE_ANGLE_IMAGE',
        'ANGLE_MISMATCH', 'ASSET_REPLACED'
      ) then
      v_ready_angles := v_ready_angles + 1;
    else
      v_blockers := array_append(v_blockers, 'STRUCTURAL_FAILURE_PRESENT');
    end if;
  end loop;

  return query
  select
    coalesce(
      graftvision_private.read_scan_package_readiness(p_scan_session_id)
      and cardinality(v_blockers) = 0 and v_ready_angles = 7,
      false
    ),
    coalesce(v_review.revision, 0),
    7,
    v_ready_angles,
    coalesce((select array_agg(distinct blocker order by blocker) from unnest(v_blockers) blocker), '{}'::text[]),
    clock_timestamp();
end;
$$;
revoke all on function graftvision_private.read_scan_package_readiness(uuid, uuid, uuid)
  from public, anon, authenticated;
