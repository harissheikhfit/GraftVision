-- AI-MAP-002C corrective migration: bind genuine inference to an existing worker lease and tenant context.
create or replace function graftvision_private.ai_map_json_number_in_bounds(
  p_value text, p_min numeric, p_max numeric
) returns boolean
language plpgsql immutable security definer set search_path = '' as $$
begin
  if p_value is null or p_value !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    return false;
  end if;
  return p_value::numeric between p_min and p_max;
end;
$$;
revoke all on function graftvision_private.ai_map_json_number_in_bounds(text,numeric,numeric) from public, anon, authenticated;

drop function graftvision_private.begin_ai_map_proposal_execution(uuid,text,text,text,text,text,text,uuid);
create or replace function graftvision_private.begin_ai_map_proposal_execution(
  p_proposal_id uuid,
  p_clinic_id uuid,
  p_worker_id uuid,
  p_reconstruction_job_id uuid,
  p_reconstruction_attempt_count integer,
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
  j public.reconstruction_job%rowtype;
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
  if graftvision_private.current_clinic_id() is distinct from p_clinic_id then
    raise exception using errcode = '42501', message = 'AI_MAP_TENANT_CONTEXT_DENIED';
  end if;

  perform set_config('graftvision.reconstruction_worker', 'on', true);
  select * into strict j from graftvision_private.require_reconstruction_job_lease(
    p_reconstruction_job_id, p_worker_id, p_reconstruction_attempt_count
  );
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

  if j.clinic_id <> p_clinic_id
     or p.clinic_id <> m.clinic_id
     or p.clinic_id <> o.clinic_id
     or p.clinic_id <> a.clinic_id
    or m.reconstruction_job_id is distinct from j.id
     or p.package_state <> 'queued'
     or p.geometry_revision <> m.geometry_revision
     or m.normalization_version <> p.model_normalization_version then
    raise exception using errcode = '42501', message = 'AI_MAP_BINDING_DENIED';
  end if;

  h := encode(extensions.digest(concat_ws(':', p_proposal_id, p_clinic_id, p_worker_id,
    p_reconstruction_job_id, p_reconstruction_attempt_count, p_adapter_name, p_adapter_version,
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
-- graftvision:dangerous-sql-approved task=AI-MAP-002C
-- graftvision:dangerous-sql-reason A lease- and tenant-authorized execution advances only its bound proposal.
-- graftvision:corrective-plan Forward-fix through an additive migration; proposal history remains append-only.
  update public.ai_map_proposal_package set package_state = 'running', started_at = coalesce(started_at, clock_timestamp()) where id = p.id;
  insert into public.ai_map_proposal_event(proposal_package_id, clinic_id, event_type) values (p.id, p.clinic_id, 'proposal_running');
  return query select x, true;
end;
$$;
revoke all on function graftvision_private.begin_ai_map_proposal_execution(uuid,uuid,uuid,uuid,integer,text,text,text,text,text,text,uuid) from public, anon, authenticated;

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
     or exists (select 1 from jsonb_array_elements(p_landmarks) v where jsonb_typeof(v->'normalized_coordinate') <> 'array' or jsonb_array_length(v->'normalized_coordinate') <> 3
       or exists (select 1 from jsonb_array_elements(v->'normalized_coordinate') n where not graftvision_private.ai_map_json_number_in_bounds(n #>> '{}', -2, 2))
       or not graftvision_private.ai_map_json_number_in_bounds(v->>'confidence', 0, 1))
     or exists (select 1 from jsonb_array_elements(p_curves) v where jsonb_typeof(v->'control_points') <> 'array' or jsonb_array_length(v->'control_points') <> 10
       or exists (select 1 from jsonb_array_elements(v->'control_points') n where not graftvision_private.ai_map_json_number_in_bounds(n->>'x', -2, 2) or not graftvision_private.ai_map_json_number_in_bounds(n->>'y', -2, 2) or not graftvision_private.ai_map_json_number_in_bounds(n->>'z', -2, 2))
       or not graftvision_private.ai_map_json_number_in_bounds(v->>'confidence', 0, 1))
     or exists (select 1 from jsonb_array_elements(p_regions) v where jsonb_typeof(v->'boundary_points') <> 'array' or jsonb_array_length(v->'boundary_points') <> 10 or v->>'closed' <> 'true'
       or exists (select 1 from jsonb_array_elements(v->'boundary_points') n where not graftvision_private.ai_map_json_number_in_bounds(n->>'x', -2, 2) or not graftvision_private.ai_map_json_number_in_bounds(n->>'y', -2, 2) or not graftvision_private.ai_map_json_number_in_bounds(n->>'z', -2, 2))
       or not graftvision_private.ai_map_json_number_in_bounds(v->>'confidence', 0, 1)) then
    raise exception using errcode = '22023', message = 'AI_MAP_OUTPUT_INVALID';
  end if;
  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.ai_map_proposal_landmark(proposal_package_id, clinic_id, patient_id, consultation_id, landmark_code, normalized_coordinate, confidence, quality_state, source_view_count, coordinate_frame_version)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'landmark_code', array[(v->'normalized_coordinate'->>0)::numeric,(v->'normalized_coordinate'->>1)::numeric,(v->'normalized_coordinate'->>2)::numeric], (v->>'confidence')::numeric, 'high', 3, p.model_normalization_version from jsonb_array_elements(p_landmarks) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
  insert into public.ai_map_proposal_curve(proposal_package_id, clinic_id, patient_id, consultation_id, curve_code, control_points, closed, confidence, quality_state, source_view_count)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'curve_code', v->'control_points', coalesce((v->>'closed')::boolean,false), (v->>'confidence')::numeric, 'high', 3 from jsonb_array_elements(p_curves) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
  insert into public.ai_map_proposal_region(proposal_package_id, clinic_id, patient_id, consultation_id, region_code, boundary_points, closed, confidence, quality_state, source_view_count)
    select e.proposal_package_id, p.clinic_id, p.patient_id, p.consultation_id, v->>'region_code', v->'boundary_points', true, (v->>'confidence')::numeric, 'high', 3 from jsonb_array_elements(p_regions) v cross join public.ai_map_proposal_package p where p.id=e.proposal_package_id;
-- graftvision:dangerous-sql-approved task=AI-MAP-002C
-- graftvision:dangerous-sql-reason Output is recorded only after all exact-shape and finite-geometry checks pass.
-- graftvision:corrective-plan Forward-fix through an additive migration; the surrounding transaction is atomic.
  update public.ai_map_inference_execution set output_recorded = true where id = e.id;
end;
$$;
revoke all on function graftvision_private.record_ai_map_proposal_output(uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;

create or replace function graftvision_private.import_ai_map_suggestion_to_draft(
  p_session_id uuid, p_provider_identity_id uuid, p_annotation_package_id uuid,
  p_suggestion_id uuid, p_suggestion_kind text, p_expected_package_revision integer, p_idempotency_key uuid
) returns table(version_id uuid, package_revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg public.model_annotation_package%rowtype;
  v_context record;
  v_existing public.ai_map_proposal_idempotency%rowtype;
  v_version_id uuid;
  v_proposal_id uuid;
  v_clinic_id uuid;
begin
  select * into strict v_context from graftvision_private.require_active_application_session(p_session_id,p_provider_identity_id);
  select p.* into strict v_pkg from public.model_annotation_package p where p.id = p_annotation_package_id;
  select c.clinic_id into strict v_clinic_id from public.consultation c where c.id = v_pkg.consultation_id;
  if v_pkg.clinic_id <> v_clinic_id then raise exception using errcode='42501', message='ANNOTATION_PACKAGE_WRITE_DENIED'; end if;
  if v_context.clinic_id <> v_clinic_id or not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,v_pkg.consultation_id,'CONSULT-PERM-001') then
    raise exception using errcode='42501', message='ANNOTATION_PACKAGE_WRITE_DENIED';
  end if;

  if p_suggestion_kind = 'landmark' then
    select proposal_package_id into strict v_proposal_id from public.ai_map_proposal_landmark where id=p_suggestion_id and clinic_id=v_clinic_id and patient_id=v_pkg.patient_id and consultation_id=v_pkg.consultation_id;
  elsif p_suggestion_kind = 'curve' then
    select proposal_package_id into strict v_proposal_id from public.ai_map_proposal_curve where id=p_suggestion_id and clinic_id=v_clinic_id and patient_id=v_pkg.patient_id and consultation_id=v_pkg.consultation_id;
  elsif p_suggestion_kind = 'region' then
    select proposal_package_id into strict v_proposal_id from public.ai_map_proposal_region where id=p_suggestion_id and clinic_id=v_clinic_id and patient_id=v_pkg.patient_id and consultation_id=v_pkg.consultation_id;
  else
    raise exception using errcode='40001', message='INVALID_KIND';
  end if;
  if not exists (select 1 from public.ai_map_proposal_package p where p.id=v_proposal_id and p.clinic_id=v_clinic_id and p.package_state='completed')
     or not exists (select 1 from public.ai_map_proposal_decision d where d.proposal_package_id=v_proposal_id and d.clinic_id=v_clinic_id and d.doctor_platform_user_id=p_provider_identity_id and d.suggestion_id=p_suggestion_id and d.annotation_kind=p_suggestion_kind and d.decision_type in ('accepted','modified')) then
    raise exception using errcode='42501', message='AI_MAP_DOCTOR_DECISION_REQUIRED';
  end if;

  select * into v_existing from public.ai_map_proposal_idempotency where clinic_id=v_clinic_id and actor_platform_user_id=p_provider_identity_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.operation<>'import_suggestion' then raise exception using errcode='40001',message='IDEMPOTENCY_MISMATCH'; end if;
    return query select v_existing.result_annotation_version_id, p_expected_package_revision, false; return;
  end if;
  select * into strict v_pkg from public.model_annotation_package where id=p_annotation_package_id for update;
  if v_pkg.revision <> p_expected_package_revision then raise exception using errcode='40001', message='PACKAGE_REVISION_MISMATCH'; end if;
  if v_pkg.package_state <> 'draft' then raise exception using errcode='40001', message='PACKAGE_FINALIZED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  if p_suggestion_kind = 'landmark' then
    insert into public.model_annotation_landmark_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,landmark_code,normalized_coordinate,surface_reference,coordinate_frame_version,revision,created_by)
    select p_annotation_package_id,v_clinic_id,v_pkg.patient_id,v_pkg.consultation_id,v_pkg.model_package_id,v_pkg.reconstruction_output_manifest_id,v_pkg.model_artifact_id,v_pkg.geometry_revision,s.landmark_code,s.normalized_coordinate,s.surface_reference,s.coordinate_frame_version,v_pkg.revision+1,p_provider_identity_id from public.ai_map_proposal_landmark s where s.id=p_suggestion_id returning id into v_version_id;
  elsif p_suggestion_kind = 'curve' then
    insert into public.model_annotation_curve_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,curve_code,control_points,closed,smoothing_mode,revision,created_by)
    select p_annotation_package_id,v_clinic_id,v_pkg.patient_id,v_pkg.consultation_id,v_pkg.model_package_id,v_pkg.reconstruction_output_manifest_id,v_pkg.model_artifact_id,v_pkg.geometry_revision,s.curve_code,s.control_points,s.closed,s.smoothing_mode,v_pkg.revision+1,p_provider_identity_id from public.ai_map_proposal_curve s where s.id=p_suggestion_id returning id into v_version_id;
  else
    insert into public.model_annotation_region_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,region_code,boundary_points,closed,revision,created_by)
    select p_annotation_package_id,v_clinic_id,v_pkg.patient_id,v_pkg.consultation_id,v_pkg.model_package_id,v_pkg.reconstruction_output_manifest_id,v_pkg.model_artifact_id,v_pkg.geometry_revision,s.region_code,s.boundary_points,s.closed,v_pkg.revision+1,p_provider_identity_id from public.ai_map_proposal_region s where s.id=p_suggestion_id returning id into v_version_id;
  end if;
-- graftvision:dangerous-sql-approved task=AI-MAP-001
-- graftvision:dangerous-sql-reason An explicit Doctor decision permits one controlled draft revision increment.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable versions and provenance remain preserved.
  update public.model_annotation_package set revision=revision+1 where id=p_annotation_package_id;
  insert into public.model_annotation_ai_provenance(annotation_version_id,annotation_kind,clinic_id,ai_proposal_suggestion_id,ai_proposal_package_id) values(v_version_id,p_suggestion_kind,v_clinic_id,p_suggestion_id,v_proposal_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,actor_platform_user_id,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',v_clinic_id,'user',p_provider_identity_id,'ai_map.proposal_imported','model_annotation_package',p_annotation_package_id,'success',p_idempotency_key,'database',jsonb_build_object('suggestion_id',p_suggestion_id,'proposal_package_id',v_proposal_id));
  insert into public.ai_map_proposal_idempotency(clinic_id,actor_platform_user_id,idempotency_key,operation,result_annotation_version_id) values(v_clinic_id,p_provider_identity_id,p_idempotency_key,'import_suggestion',v_version_id);
  return query select v_version_id,v_pkg.revision+1,true;
end;
$$;
revoke all on function graftvision_private.import_ai_map_suggestion_to_draft(uuid,uuid,uuid,uuid,text,integer,uuid) from public, anon, authenticated;