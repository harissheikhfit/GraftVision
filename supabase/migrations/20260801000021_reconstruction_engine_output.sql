-- RECON-003: synthetic, non-clinical geometry output lifecycle. Geometry bytes stay in private worker storage.
create table public.reconstruction_artifact (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  prepared_input_manifest_id uuid not null references public.reconstruction_prepared_manifest(id),
  artifact_type text not null check (artifact_type in ('mesh_glb')),
  object_reference uuid not null default gen_random_uuid(),
  checksum text not null check (checksum ~ '^[A-Fa-f0-9]{64}$'),
  mime_type text not null check (mime_type = 'model/gltf-binary'),
  byte_size integer not null check (byte_size between 1 and 52428800),
  engine_name text not null check (engine_name = 'recon-engine-synthetic-v1'),
  engine_version text not null check (engine_version = '1.0.0'),
  configuration_version text not null check (configuration_version = 'recon-config-synthetic-v1'),
  created_at timestamptz not null default clock_timestamp(),
  unique (reconstruction_job_id, attempt_count, artifact_type)
);

create table public.reconstruction_output_manifest (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  scan_session_id uuid not null references public.scan_session(id),
  analyzer_handoff_id uuid not null references public.scan_analyzer_handoff(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  prepared_input_manifest_id uuid not null references public.reconstruction_prepared_manifest(id),
  artifact_ids uuid[] not null check (cardinality(artifact_ids) = 1),
  engine_name text not null check (engine_name = 'recon-engine-synthetic-v1'),
  engine_version text not null check (engine_version = '1.0.0'),
  configuration_version text not null check (configuration_version = 'recon-config-synthetic-v1'),
  vertex_count integer not null check (vertex_count > 0 and vertex_count <= 10000000),
  face_count integer not null check (face_count >= 0 and face_count <= 20000000),
  point_count integer not null check (point_count >= 0 and point_count <= 10000000),
  bounding_box_mm numeric[] not null check (cardinality(bounding_box_mm) = 3),
  coordinate_system_code text not null check (coordinate_system_code = 'RIGHT_HANDED_Y_UP'),
  unit_code text not null check (unit_code = 'MILLIMETRE'),
  validation_status text not null check (validation_status = 'valid'),
  created_at timestamptz not null default clock_timestamp(),
  unique (reconstruction_job_id, attempt_count)
);

create table public.reconstruction_output_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  event_type text not null check (event_type in ('execution_started','artifact_recorded','output_manifest_created','execution_succeeded','execution_failed')),
  artifact_id uuid references public.reconstruction_artifact(id),
  revision integer not null check (revision > 0),
  progress_stage text not null check (progress_stage in ('reconstruction_running','finalizing','completed')),
  failure_code text,
  worker_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp()
);

create table public.reconstruction_output_idempotency (
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  worker_id uuid not null,
  idempotency_key uuid not null,
  operation text not null check (operation in ('begin','record_artifact','finalize_output')),
  payload_hash text not null,
  artifact_id uuid references public.reconstruction_artifact(id),
  output_manifest_id uuid references public.reconstruction_output_manifest(id),
  primary key (reconstruction_job_id, attempt_count, worker_id, idempotency_key)
);

alter table public.reconstruction_artifact enable row level security;
alter table public.reconstruction_artifact force row level security;
alter table public.reconstruction_output_manifest enable row level security;
alter table public.reconstruction_output_manifest force row level security;
alter table public.reconstruction_output_event enable row level security;
alter table public.reconstruction_output_event force row level security;
alter table public.reconstruction_output_idempotency enable row level security;
alter table public.reconstruction_output_idempotency force row level security;
revoke all on public.reconstruction_artifact, public.reconstruction_output_manifest, public.reconstruction_output_event, public.reconstruction_output_idempotency from public, anon, authenticated;
create trigger reconstruction_artifact_controlled before insert or update or delete on public.reconstruction_artifact for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_output_manifest_controlled before insert or update or delete on public.reconstruction_output_manifest for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_output_event_controlled before insert or update or delete on public.reconstruction_output_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_output_idempotency_controlled before insert or update or delete on public.reconstruction_output_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

do $$
declare definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into definition;
  if position('''reconstruction.execution_started''' in definition) = 0 then
    definition := replace(definition, '''reconstruction.preparation_failed''', '''reconstruction.preparation_failed'', ''reconstruction.execution_started'', ''reconstruction.artifact_recorded'', ''reconstruction.output_manifest_created'', ''reconstruction.execution_succeeded'', ''reconstruction.execution_failed''');
    execute definition;
  end if;
  select pg_get_functiondef('graftvision_private.is_valid_audit_resource_type(text)'::regprocedure) into definition;
  if position('''reconstruction_output_manifest''' in definition) = 0 then
    definition := replace(definition, '''reconstruction_prepared_manifest''', '''reconstruction_prepared_manifest'', ''reconstruction_artifact'', ''reconstruction_output_manifest''');
    execute definition;
  end if;
end;
$$;

create function graftvision_private.begin_reconstruction_execution(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_idempotency_key uuid)
returns table(job_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; x public.reconstruction_output_idempotency%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or not exists(select 1 from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count) then raise exception using errcode='40001',message='PREPARED_MANIFEST_INVALID'; end if;
  select * into x from public.reconstruction_output_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if x.operation<>'begin' then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_IDEMPOTENCY_MISMATCH'; end if; return query select j.id,j.revision,false; return; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-003
-- graftvision:dangerous-sql-reason A leased worker begins one bounded non-clinical execution attempt.
-- graftvision:corrective-plan Forward-fix with an additive migration; output events remain immutable.
  update public.reconstruction_job set revision=revision+1,progress_percentage=90,progress_stage='reconstruction_running',updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_output_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'begin',j.manifest_id::text);
  insert into public.reconstruction_output_event(clinic_id,reconstruction_job_id,attempt_count,event_type,revision,progress_stage,worker_id) values(j.clinic_id,j.id,j.attempt_count,'execution_started',j.revision,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.execution_started','reconstruction_job',j.id,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,true;
end;
$$;

create function graftvision_private.record_reconstruction_artifact(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_prepared_manifest_id uuid,p_checksum text,p_byte_size integer,p_idempotency_key uuid)
returns table(artifact_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; x public.reconstruction_output_idempotency%rowtype; a uuid;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or not exists(select 1 from public.reconstruction_prepared_manifest m where m.id=p_prepared_manifest_id and m.reconstruction_job_id=j.id and m.attempt_count=j.attempt_count) or p_checksum !~ '^[A-Fa-f0-9]{64}$' or p_byte_size not between 1 and 52428800 then raise exception using errcode='40001',message='RECONSTRUCTION_ARTIFACT_INVALID'; end if;
  select * into x from public.reconstruction_output_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if x.operation<>'record_artifact' or x.payload_hash<>concat(p_prepared_manifest_id::text,':',p_checksum,':',p_byte_size) then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_IDEMPOTENCY_MISMATCH'; end if; return query select x.artifact_id,j.revision,false; return; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_artifact(clinic_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_type,checksum,mime_type,byte_size) values(j.clinic_id,j.id,j.attempt_count,p_prepared_manifest_id,'mesh_glb',p_checksum,'model/gltf-binary',p_byte_size) returning id into a;
  insert into public.reconstruction_output_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,artifact_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'record_artifact',concat(p_prepared_manifest_id::text,':',p_checksum,':',p_byte_size),a);
  insert into public.reconstruction_output_event(clinic_id,reconstruction_job_id,attempt_count,event_type,artifact_id,revision,progress_stage,worker_id) values(j.clinic_id,j.id,j.attempt_count,'artifact_recorded',a,j.revision,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.artifact_recorded','reconstruction_artifact',a,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select a,j.revision,true;
end;
$$;

create function graftvision_private.finalize_reconstruction_output(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_vertex_count integer,p_face_count integer,p_point_count integer,p_bounding_box_mm numeric[],p_idempotency_key uuid)
returns table(output_manifest_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; x public.reconstruction_output_idempotency%rowtype; m public.reconstruction_prepared_manifest%rowtype; aid uuid[]; oid uuid;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or p_vertex_count<=0 or p_face_count<0 or p_point_count<0 or cardinality(p_bounding_box_mm)<>3 or exists(select 1 from public.reconstruction_output_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count) then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_INVALID'; end if;
  select * into x from public.reconstruction_output_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if x.operation<>'finalize_output' then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_IDEMPOTENCY_MISMATCH'; end if; return query select x.output_manifest_id,j.revision,false; return; end if;
  select * into strict m from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count;
  select array_agg(id) into aid from public.reconstruction_artifact where reconstruction_job_id=j.id and attempt_count=j.attempt_count and prepared_input_manifest_id=m.id;
  if cardinality(aid)<>1 then raise exception using errcode='40001',message='RECONSTRUCTION_ARTIFACT_INVALID'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_output_manifest(clinic_id,patient_id,consultation_id,scan_session_id,analyzer_handoff_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_ids,vertex_count,face_count,point_count,bounding_box_mm) select j.clinic_id,j.patient_id,j.consultation_id,j.scan_session_id,im.analyzer_handoff_id,j.id,j.attempt_count,m.id,aid,p_vertex_count,p_face_count,p_point_count,p_bounding_box_mm from public.reconstruction_input_manifest im where im.id=j.manifest_id returning id into oid;
-- graftvision:dangerous-sql-approved task=RECON-003
-- graftvision:dangerous-sql-reason Only a valid current leased attempt with one immutable output may succeed.
-- graftvision:corrective-plan Forward-fix with an additive migration; prior artifacts and output evidence remain immutable.
  update public.reconstruction_job set state='succeeded',revision=revision+1,progress_percentage=100,progress_stage='completed',completed_at=clock_timestamp(),worker_lease_owner=null,lease_expires_at=null,updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_output_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,output_manifest_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'finalize_output',concat(p_vertex_count,':',p_face_count,':',p_point_count),oid);
  insert into public.reconstruction_output_event(clinic_id,reconstruction_job_id,attempt_count,event_type,revision,progress_stage,worker_id) values(j.clinic_id,j.id,j.attempt_count,'output_manifest_created',j.revision,'completed',p_worker_id),(j.clinic_id,j.id,j.attempt_count,'execution_succeeded',j.revision,'completed',p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.output_manifest_created','reconstruction_output_manifest',oid,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision)),('clinic',j.clinic_id,'system','reconstruction.execution_succeeded','reconstruction_job',j.id,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select oid,j.revision,true;
end;
$$;

create function graftvision_private.read_reconstruction_output_status(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid)
returns table(state text,progress_stage text,progress_percentage integer,engine_version text,attempt_count integer,created_at timestamptz,completed_at timestamptz,failure_code text,output_available boolean,vertex_count integer,face_count integer,point_count integer,bounding_box_mm numeric[],coordinate_system_code text,unit_code text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  perform graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_OUTPUT_DENIED'; end if;
  return query select j.state,j.progress_stage,j.progress_percentage,'1.0.0',j.attempt_count,j.created_at,j.completed_at,j.failure_code,(o.id is not null),o.vertex_count,o.face_count,o.point_count,o.bounding_box_mm,o.coordinate_system_code,o.unit_code from public.reconstruction_job j2 left join public.reconstruction_output_manifest o on o.reconstruction_job_id=j2.id and o.attempt_count=j2.attempt_count where j2.id=j.id;
end;
$$;

revoke all on function graftvision_private.begin_reconstruction_execution(uuid,uuid,integer,integer,uuid), graftvision_private.record_reconstruction_artifact(uuid,uuid,integer,integer,uuid,text,integer,uuid), graftvision_private.finalize_reconstruction_output(uuid,uuid,integer,integer,integer,integer,integer,numeric[],uuid), graftvision_private.read_reconstruction_output_status(uuid,uuid,uuid) from public, anon, authenticated;
