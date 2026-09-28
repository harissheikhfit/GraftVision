-- AI-MAP-002C: trusted genuine inference execution contract.
-- The execution binding is server-created from the persisted model/reconstruction lineage.
create table public.ai_map_inference_execution (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null unique references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  model_package_id uuid not null references public.scalp_model_package(id),
  reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id),
  reconstruction_artifact_id uuid not null references public.reconstruction_artifact(id),
  reconstruction_attempt_count integer not null check (reconstruction_attempt_count > 0),
  geometry_revision integer not null check (geometry_revision > 0),
  artifact_checksum text not null check (artifact_checksum ~ '^[A-Fa-f0-9]{64}$'),
  adapter_name text not null check (adapter_name = 'onnx-ai-map-adapter-v2'),
  adapter_version text not null check (adapter_version = '2.0.0-dev'),
  model_name text not null check (model_name = 'graftvision-synthetic-scalp-segmentation'),
  model_version text not null check (model_version = '0.2.0'),
  inference_pipeline_version text not null check (inference_pipeline_version = 'graftvision-ai-map-onnx-pipeline-v2'),
  input_shape integer[] not null check (input_shape = array[1, 100]),
  output_shape integer[] not null check (output_shape = array[1, 500]),
  execution_state text not null check (execution_state in ('running', 'completed', 'failed')),
  output_recorded boolean not null default false,
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,64}$')
);

alter table public.ai_map_inference_execution enable row level security;
alter table public.ai_map_inference_execution force row level security;
revoke all on public.ai_map_inference_execution from public, anon, authenticated;
create trigger ai_map_inference_execution_controlled before insert or update or delete
on public.ai_map_inference_execution for each row execute function graftvision_private.enforce_controlled_scan_mutation();

alter table public.ai_map_proposal_package
  drop constraint ai_map_proposal_package_ai_adapter_version_check,
  drop constraint ai_map_proposal_package_inference_pipeline_version_check;
alter table public.ai_map_proposal_package
  add constraint ai_map_proposal_package_ai_adapter_version_check
    check (ai_adapter_version = '2.0.0-dev'),
  add constraint ai_map_proposal_package_inference_pipeline_version_check
    check (inference_pipeline_version = 'graftvision-ai-map-onnx-pipeline-v2');

-- Queue metadata is server-owned and must match the genuine adapter contract.
do $$
declare definition text;
begin
  select pg_get_functiondef('graftvision_private.queue_ai_map_proposal(uuid,uuid,uuid,uuid,uuid)'::regprocedure)
    into definition;
  definition := replace(definition, '''graftvision-synthetic''', '''graftvision-synthetic-scalp-segmentation''');
  definition := replace(definition, '''1.0''', '''0.2.0''');
  definition := replace(definition, '''graftvision-ai-adapter-v1''', '''2.0.0-dev''');
  definition := replace(definition, '''graftvision-inference-v1''', '''graftvision-ai-map-onnx-pipeline-v2''');
  execute definition;
end;
$$;

drop function if exists graftvision_private.begin_ai_map_proposal_execution(uuid);

create or replace function graftvision_private.begin_ai_map_proposal_execution(
  p_proposal_id uuid,
  p_adapter_name text,
  p_adapter_version text,
  p_model_name text,
  p_model_version text,
  p_pipeline_version text,
  p_artifact_checksum text,
  p_idempotency_key uuid
) returns table(execution_id uuid, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  p public.ai_map_proposal_package%rowtype;
  m public.scalp_model_package%rowtype;
  o public.reconstruction_output_manifest%rowtype;
  a public.reconstruction_artifact%rowtype;
  e public.ai_map_inference_execution%rowtype;
  h text;
  x uuid;
begin
  if p_adapter_name <> 'onnx-ai-map-adapter-v2'
     or p_adapter_version <> '2.0.0-dev'
     or p_model_name <> 'graftvision-synthetic-scalp-segmentation'
     or p_model_version <> '0.2.0'
     or p_pipeline_version <> 'graftvision-ai-map-onnx-pipeline-v2'
     or p_artifact_checksum !~ '^[A-Fa-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'AI_MAP_CONTRACT_MISMATCH';
  end if;

  select * into strict p from public.ai_map_proposal_package where id = p_proposal_id for update;
  select * into strict m from public.scalp_model_package where id = p.model_package_id;
  select * into strict o from public.reconstruction_output_manifest
    where id = p.reconstruction_output_manifest_id
      and reconstruction_job_id = m.reconstruction_job_id
      and attempt_count = p.reconstruction_attempt_count
      and validation_status = 'valid';
  select * into strict a from public.reconstruction_artifact
    where id = p.reconstruction_artifact_id
      and id = any(o.artifact_ids)
      and reconstruction_job_id = o.reconstruction_job_id
      and attempt_count = o.attempt_count
      and checksum = p_artifact_checksum;

  if p.package_state <> 'queued'
     or p.clinic_id <> m.clinic_id
     or p.clinic_id <> o.clinic_id
     or p.clinic_id <> a.clinic_id
     or p.model_package_id <> m.id
     or p.geometry_revision <> m.geometry_revision
     or p.reconstruction_attempt_count <> o.attempt_count
     or m.normalization_version <> p.model_normalization_version then
    raise exception using errcode = '42501', message = 'AI_MAP_BINDING_DENIED';
  end if;

  h := encode(extensions.digest(concat_ws(':', p_proposal_id, p_adapter_name, p_adapter_version,
    p_model_name, p_model_version, p_pipeline_version, p_artifact_checksum, p_idempotency_key), 'sha256'), 'hex');
  select * into e from public.ai_map_inference_execution where proposal_package_id = p.id;
  if found then
    if e.payload_hash <> h then
      raise exception using errcode = '40001', message = 'AI_MAP_IDEMPOTENCY_MISMATCH';
    end if;
    return query select e.id, false;
    return;
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.ai_map_inference_execution(
    proposal_package_id, clinic_id, model_package_id, reconstruction_output_manifest_id,
    reconstruction_artifact_id, reconstruction_attempt_count, geometry_revision, artifact_checksum,
    adapter_name, adapter_version, model_name, model_version, inference_pipeline_version,
    input_shape, output_shape, execution_state, idempotency_key, payload_hash
  ) values (
    p.id, p.clinic_id, m.id, o.id, a.id, o.attempt_count, m.geometry_revision, a.checksum,
    p_adapter_name, p_adapter_version, p_model_name, p_model_version, p_pipeline_version,
    array[1,100], array[1,500], 'running', p_idempotency_key, h
  ) returning id into x;

-- graftvision:dangerous-sql-approved task=AI-MAP-002
-- graftvision:dangerous-sql-reason The trusted execution binding advances only the server-created proposal after lineage checks.
-- graftvision:corrective-plan Forward-fix through this additive migration; immutable events and proposal history remain preserved.
  update public.ai_map_proposal_package
    set package_state = 'running', started_at = coalesce(started_at, clock_timestamp())
    where id = p.id;
  insert into public.ai_map_proposal_event(proposal_package_id, clinic_id, event_type)
    values (p.id, p.clinic_id, 'proposal_running');
  return query select x, true;
end;
$$;
revoke all on function graftvision_private.begin_ai_map_proposal_execution(uuid,text,text,text,text,text,text,uuid) from public, anon, authenticated;

drop function if exists graftvision_private.record_ai_map_proposal_output(uuid,jsonb,jsonb,jsonb);

create or replace function graftvision_private.record_ai_map_proposal_output(
  p_execution_id uuid, p_landmarks jsonb, p_curves jsonb, p_regions jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.ai_map_inference_execution%rowtype;
begin
  select * into strict e from public.ai_map_inference_execution where id = p_execution_id for update;
  if e.execution_state <> 'running' or e.output_recorded then
    raise exception using errcode = '40001', message = 'AI_MAP_EXECUTION_NOT_WRITABLE';
  end if;
  if jsonb_typeof(p_landmarks) <> 'array' or jsonb_array_length(p_landmarks) <> 4
     or jsonb_typeof(p_curves) <> 'array' or jsonb_array_length(p_curves) <> 6
     or jsonb_typeof(p_regions) <> 'array' or jsonb_array_length(p_regions) <> 9
     or exists (select 1 from jsonb_array_elements(p_landmarks) v where jsonb_typeof(v->'normalized_coordinate') <> 'array' or jsonb_array_length(v->'normalized_coordinate') <> 3 or (v->>'confidence')::numeric not between 0 and 1)
     or exists (select 1 from jsonb_array_elements(p_curves) v where jsonb_typeof(v->'control_points') <> 'array' or jsonb_array_length(v->'control_points') <> 10 or (v->>'confidence')::numeric not between 0 and 1)
     or exists (select 1 from jsonb_array_elements(p_regions) v where jsonb_typeof(v->'boundary_points') <> 'array' or jsonb_array_length(v->'boundary_points') <> 10 or v->>'closed' <> 'true' or (v->>'confidence')::numeric not between 0 and 1) then
    raise exception using errcode = '22023', message = 'AI_MAP_OUTPUT_INVALID';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.ai_map_proposal_landmark(proposal_package_id, clinic_id, patient_id, consultation_id, landmark_code, normalized_coordinate, confidence, quality_state, source_view_count, coordinate_frame_version)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'landmark_code', array[(v->'normalized_coordinate'->>0)::numeric,(v->'normalized_coordinate'->>1)::numeric,(v->'normalized_coordinate'->>2)::numeric], (v->>'confidence')::numeric, 'high', 3, p.model_normalization_version from jsonb_array_elements(p_landmarks) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
  insert into public.ai_map_proposal_curve(proposal_package_id, clinic_id, patient_id, consultation_id, curve_code, control_points, closed, confidence, quality_state, source_view_count)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'curve_code', v->'control_points', coalesce((v->>'closed')::boolean,false), (v->>'confidence')::numeric, 'high', 3 from jsonb_array_elements(p_curves) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
  insert into public.ai_map_proposal_region(proposal_package_id, clinic_id, patient_id, consultation_id, region_code, boundary_points, closed, confidence, quality_state, source_view_count)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'region_code', v->'boundary_points', true, (v->>'confidence')::numeric, 'high', 3 from jsonb_array_elements(p_regions) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
-- graftvision:dangerous-sql-approved task=AI-MAP-002
-- graftvision:dangerous-sql-reason Output is marked recorded only after all three validated entity sets are inserted atomically.
-- graftvision:corrective-plan Forward-fix through this additive migration; malformed output raises before this update.
  update public.ai_map_inference_execution set output_recorded = true where id = e.id;
end;
$$;
revoke all on function graftvision_private.record_ai_map_proposal_output(uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;

drop function if exists graftvision_private.finalize_ai_map_proposal(uuid,float8,text);

create or replace function graftvision_private.finalize_ai_map_proposal(
  p_execution_id uuid, p_overall_confidence float8, p_quality_state text
) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.ai_map_inference_execution%rowtype; p public.ai_map_proposal_package%rowtype;
begin
  select * into strict e from public.ai_map_inference_execution where id=p_execution_id for update;
  select * into strict p from public.ai_map_proposal_package where id=e.proposal_package_id for update;
  if e.execution_state <> 'running' or not e.output_recorded or p_quality_state not in ('high','medium','low','insufficient') or p_overall_confidence is null or p_overall_confidence not between 0 and 1 then
    raise exception using errcode='40001', message='AI_MAP_FINALIZATION_DENIED';
  end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=AI-MAP-002
-- graftvision:dangerous-sql-reason Completion advances the bound execution and proposal together after output validation.
-- graftvision:corrective-plan Forward-fix through this additive migration; transaction rollback preserves proposal integrity.
  update public.ai_map_inference_execution set execution_state='completed', completed_at=clock_timestamp() where id=e.id;
  update public.ai_map_proposal_package set package_state='completed', completed_at=clock_timestamp(), overall_confidence=p_overall_confidence, quality_state=p_quality_state where id=p.id;
  insert into public.ai_map_proposal_event(proposal_package_id,clinic_id,event_type) values(p.id,p.clinic_id,'proposal_completed');
end;
$$;
revoke all on function graftvision_private.finalize_ai_map_proposal(uuid,float8,text) from public, anon, authenticated;

drop function if exists graftvision_private.fail_ai_map_proposal(uuid);

create or replace function graftvision_private.fail_ai_map_proposal(p_execution_id uuid, p_failure_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.ai_map_inference_execution%rowtype;
begin
  select * into strict e from public.ai_map_inference_execution where id=p_execution_id for update;
  if e.execution_state <> 'running' or p_failure_code !~ '^[A-Z0-9_]{1,64}$' then raise exception using errcode='40001', message='AI_MAP_FAILURE_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=AI-MAP-002
-- graftvision:dangerous-sql-reason Failure changes only the bound running execution and its proposal lifecycle state.
-- graftvision:corrective-plan Forward-fix through this additive migration; failure remains auditable and non-clinical.
  update public.ai_map_inference_execution set execution_state='failed', failure_code=p_failure_code, completed_at=clock_timestamp() where id=e.id;
  update public.ai_map_proposal_package set package_state='failed', failure_code=p_failure_code, completed_at=clock_timestamp() where id=e.proposal_package_id;
  insert into public.ai_map_proposal_event(proposal_package_id,clinic_id,event_type) select id,clinic_id,'proposal_failed' from public.ai_map_proposal_package where id=e.proposal_package_id;
end;
$$;
revoke all on function graftvision_private.fail_ai_map_proposal(uuid,text) from public, anon, authenticated;

-- The old import body selected a non-existent proposal_package_id from annotation versions.
-- Recreate it through the existing controlled save functions in a later task; keep this contract explicit.
