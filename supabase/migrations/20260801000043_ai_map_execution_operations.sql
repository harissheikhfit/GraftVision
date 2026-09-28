-- AI-MAP-001: Execution lifecycle operations for AI proposals
drop function if exists graftvision_private.complete_synthetic_proposal(uuid);

create function graftvision_private.begin_ai_map_proposal_execution(
  p_proposal_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=AI-MAP-001
-- graftvision:dangerous-sql-reason Worker changes state to running.
-- graftvision:corrective-plan Forward-fix via additive migration.
  update public.ai_map_proposal_package
  set package_state = 'running'
  where id = p_proposal_id and package_state = 'queued';

  if not found then
    raise exception using errcode='40001', message='PROPOSAL_NOT_QUEUED';
  end if;

  insert into public.ai_map_proposal_event(proposal_package_id, clinic_id, event_type)
  select id, clinic_id, 'proposal_started' from public.ai_map_proposal_package where id = p_proposal_id;
end;
$$;
revoke all on function graftvision_private.begin_ai_map_proposal_execution(uuid) from public, anon, authenticated;


create function graftvision_private.record_ai_map_proposal_output(
  p_proposal_id uuid,
  p_landmarks jsonb,
  p_curves jsonb,
  p_regions jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pkg public.ai_map_proposal_package%rowtype;
begin
  perform set_config('graftvision.scan_controlled','on',true);
  
  select * into strict v_pkg from public.ai_map_proposal_package where id = p_proposal_id;
  if v_pkg.package_state <> 'running' then
    raise exception using errcode='40001', message='PROPOSAL_NOT_RUNNING';
  end if;

  if p_landmarks is not null and jsonb_array_length(p_landmarks) > 0 then
    insert into public.ai_map_proposal_landmark(proposal_package_id, clinic_id, patient_id, consultation_id, landmark_code, normalized_coordinate, confidence, quality_state, source_view_count, coordinate_frame_version)
    select p_proposal_id, v_pkg.clinic_id, v_pkg.patient_id, v_pkg.consultation_id,
           (value->>'landmark_code')::text,
           array[
             (value->'normalized_coordinate'->>0)::numeric,
             (value->'normalized_coordinate'->>1)::numeric,
             (value->'normalized_coordinate'->>2)::numeric
           ]::numeric[],
           (value->>'confidence')::numeric,
           'high', 7, 'graftvision-model-normalization-v1'
    from jsonb_array_elements(p_landmarks);
  end if;

  if p_curves is not null and jsonb_array_length(p_curves) > 0 then
    insert into public.ai_map_proposal_curve(proposal_package_id, clinic_id, patient_id, consultation_id, curve_code, control_points, closed, confidence, quality_state, source_view_count)
    select p_proposal_id, v_pkg.clinic_id, v_pkg.patient_id, v_pkg.consultation_id,
           (value->>'curve_code')::text,
           (value->'control_points')::jsonb,
           coalesce((value->>'closed')::boolean, false),
           (value->>'confidence')::numeric,
           'high', 7
    from jsonb_array_elements(p_curves);
  end if;

  if p_regions is not null and jsonb_array_length(p_regions) > 0 then
    insert into public.ai_map_proposal_region(proposal_package_id, clinic_id, patient_id, consultation_id, region_code, boundary_points, closed, confidence, quality_state, source_view_count)
    select p_proposal_id, v_pkg.clinic_id, v_pkg.patient_id, v_pkg.consultation_id,
           (value->>'region_code')::text,
           (value->'boundary_points')::jsonb,
           coalesce((value->>'closed')::boolean, true),
           (value->>'confidence')::numeric,
           'high', 7
    from jsonb_array_elements(p_regions);
  end if;
end;
$$;
revoke all on function graftvision_private.record_ai_map_proposal_output(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;


create function graftvision_private.finalize_ai_map_proposal(
  p_proposal_id uuid,
  p_overall_confidence float8,
  p_quality_state text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=AI-MAP-001
-- graftvision:dangerous-sql-reason Worker completes deterministically.
-- graftvision:corrective-plan Forward-fix via additive migration.
  update public.ai_map_proposal_package
  set package_state = 'completed', completed_at = clock_timestamp(),
      overall_confidence = p_overall_confidence, quality_state = p_quality_state
  where id = p_proposal_id and package_state = 'running';

  if not found then
    raise exception using errcode='40001', message='PROPOSAL_NOT_RUNNING';
  end if;

  insert into public.ai_map_proposal_event(proposal_package_id, clinic_id, event_type)
  select id, clinic_id, 'proposal_completed' from public.ai_map_proposal_package where id = p_proposal_id;

  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata)
  select 'clinic', clinic_id, 'system', 'ai_map.proposal_completed', 'ai_map_proposal_package', id, 'success', id, 'system', '{}'::jsonb
  from public.ai_map_proposal_package where id = p_proposal_id;
end;
$$;
revoke all on function graftvision_private.finalize_ai_map_proposal(uuid, float8, text) from public, anon, authenticated;


create function graftvision_private.fail_ai_map_proposal(
  p_proposal_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=AI-MAP-001
-- graftvision:dangerous-sql-reason Worker marks failure deterministically.
-- graftvision:corrective-plan Forward-fix via additive migration.
  update public.ai_map_proposal_package
  set package_state = 'failed', completed_at = clock_timestamp()
  where id = p_proposal_id and package_state in ('queued', 'running');

  if not found then
    raise exception using errcode='40001', message='PROPOSAL_CANNOT_FAIL';
  end if;

  insert into public.ai_map_proposal_event(proposal_package_id, clinic_id, event_type)
  select id, clinic_id, 'proposal_failed' from public.ai_map_proposal_package where id = p_proposal_id;
end;
$$;
revoke all on function graftvision_private.fail_ai_map_proposal(uuid) from public, anon, authenticated;
