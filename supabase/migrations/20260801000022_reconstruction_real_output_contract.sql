-- RECON-004D1: additive immutable contract extension for real COLMAP output metadata.
alter table public.reconstruction_artifact
  add column execution_mode text not null default 'synthetic',
  add column adapter_version text not null default 'recon-config-synthetic-v1';

alter table public.reconstruction_output_manifest
  add column execution_mode text not null default 'synthetic',
  add column adapter_version text not null default 'recon-config-synthetic-v1';

alter table public.reconstruction_artifact
  drop constraint if exists reconstruction_artifact_artifact_type_check,
  drop constraint if exists reconstruction_artifact_mime_type_check,
  drop constraint if exists reconstruction_artifact_engine_name_check,
  drop constraint if exists reconstruction_artifact_engine_version_check,
  drop constraint if exists reconstruction_artifact_configuration_version_check;
alter table public.reconstruction_artifact
  add constraint reconstruction_artifact_artifact_type_check check (artifact_type in ('mesh_glb','sparse_point_cloud','dense_point_cloud','surface_mesh','reconstruction_preview','bounded_metadata')),
  add constraint reconstruction_artifact_mime_type_check check (mime_type in ('model/gltf-binary','application/ply','model/obj','application/json','image/png','image/webp','application/octet-stream')),
  add constraint reconstruction_artifact_engine_name_check check (engine_name in ('recon-engine-synthetic-v1','COLMAP')),
  add constraint reconstruction_artifact_engine_version_check check (engine_version in ('1.0.0','4.1.1')),
  add constraint reconstruction_artifact_configuration_version_check check (configuration_version in ('recon-config-synthetic-v1','recon-colmap-config-v2')),
  add constraint reconstruction_artifact_adapter_version_check check (adapter_version in ('recon-config-synthetic-v1','recon-colmap-adapter-v2')),
  add constraint reconstruction_artifact_execution_mode_check check (execution_mode in ('synthetic','sparse_cpu','dense_cuda')),
  add constraint reconstruction_artifact_contract_check check (
    (artifact_type='mesh_glb' and mime_type='model/gltf-binary' and execution_mode='synthetic') or
    (artifact_type='sparse_point_cloud' and mime_type='application/ply' and execution_mode in ('sparse_cpu','dense_cuda')) or
    (artifact_type='dense_point_cloud' and mime_type='application/ply' and execution_mode='dense_cuda') or
    (artifact_type='surface_mesh' and mime_type in ('model/gltf-binary','model/obj') and execution_mode='dense_cuda') or
    (artifact_type='reconstruction_preview' and mime_type in ('image/png','image/webp')) or
    (artifact_type='bounded_metadata' and mime_type in ('application/json','application/octet-stream'))
  );

alter table public.reconstruction_output_manifest
  drop constraint if exists reconstruction_output_manifest_engine_name_check,
  drop constraint if exists reconstruction_output_manifest_engine_version_check,
  drop constraint if exists reconstruction_output_manifest_configuration_version_check;
alter table public.reconstruction_output_manifest
  add constraint reconstruction_output_manifest_engine_name_check check (engine_name in ('recon-engine-synthetic-v1','COLMAP')),
  add constraint reconstruction_output_manifest_engine_version_check check (engine_version in ('1.0.0','4.1.1')),
  add constraint reconstruction_output_manifest_configuration_version_check check (configuration_version in ('recon-config-synthetic-v1','recon-colmap-config-v2')),
  add constraint reconstruction_output_manifest_adapter_version_check check (adapter_version in ('recon-config-synthetic-v1','recon-colmap-adapter-v2')),
  add constraint reconstruction_output_manifest_execution_mode_check check (execution_mode in ('synthetic','sparse_cpu','dense_cuda'));

create table public.reconstruction_artifact_geometry (
  artifact_id uuid primary key references public.reconstruction_artifact(id),
  point_count integer not null default 0 check (point_count between 0 and 10000000),
  vertex_count integer not null default 0 check (vertex_count between 0 and 10000000),
  face_count integer not null default 0 check (face_count between 0 and 20000000),
  bounding_box_min numeric[] not null check (cardinality(bounding_box_min)=3 and not ('NaN'::numeric=any(bounding_box_min))),
  bounding_box_max numeric[] not null check (cardinality(bounding_box_max)=3 and not ('NaN'::numeric=any(bounding_box_max))),
  coordinate_system_code text not null check (coordinate_system_code='RIGHT_HANDED_Y_UP'),
  unit_code text not null check (unit_code='MILLIMETRE'),
  validation_status text not null check (validation_status='valid'),
  sparse_or_dense text not null check (sparse_or_dense in ('synthetic','sparse','dense')),
  check ((point_count>0) or (vertex_count>0)),
  check (bounding_box_min[1]<=bounding_box_max[1] and bounding_box_min[2]<=bounding_box_max[2] and bounding_box_min[3]<=bounding_box_max[3])
);
alter table public.reconstruction_artifact_geometry enable row level security;
alter table public.reconstruction_artifact_geometry force row level security;
revoke all on public.reconstruction_artifact_geometry from public, anon, authenticated;
create trigger reconstruction_artifact_geometry_controlled before insert or update or delete on public.reconstruction_artifact_geometry for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.record_real_reconstruction_artifact(
  p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,
  p_prepared_manifest_id uuid,p_artifact_type text,p_checksum text,p_mime_type text,
  p_byte_size integer,p_engine_name text,p_engine_version text,p_adapter_version text,
  p_configuration_version text,p_execution_mode text,p_idempotency_key uuid
) returns table(artifact_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; x public.reconstruction_output_idempotency%rowtype; a uuid; h text;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or not exists(select 1 from public.reconstruction_prepared_manifest m where m.id=p_prepared_manifest_id and m.reconstruction_job_id=j.id and m.attempt_count=j.attempt_count) or p_checksum !~ '^[A-Fa-f0-9]{64}$' or p_byte_size not between 1 and 52428800 then raise exception using errcode='40001',message='RECONSTRUCTION_ARTIFACT_INVALID'; end if;
  h:=concat_ws(':',p_prepared_manifest_id::text,p_artifact_type,p_checksum,p_mime_type,p_byte_size,p_engine_name,p_engine_version,p_adapter_version,p_configuration_version,p_execution_mode);
  select * into x from public.reconstruction_output_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if x.operation<>'record_artifact' or x.payload_hash<>h then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_IDEMPOTENCY_MISMATCH'; end if; return query select x.artifact_id,j.revision,false; return; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_artifact(clinic_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_type,checksum,mime_type,byte_size,engine_name,engine_version,adapter_version,configuration_version,execution_mode)
  values(j.clinic_id,j.id,j.attempt_count,p_prepared_manifest_id,p_artifact_type,p_checksum,p_mime_type,p_byte_size,p_engine_name,p_engine_version,p_adapter_version,p_configuration_version,p_execution_mode) returning id into a;
  insert into public.reconstruction_output_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,artifact_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'record_artifact',h,a);
  insert into public.reconstruction_output_event(clinic_id,reconstruction_job_id,attempt_count,event_type,artifact_id,revision,progress_stage,worker_id) values(j.clinic_id,j.id,j.attempt_count,'artifact_recorded',a,j.revision,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.artifact_recorded','reconstruction_artifact',a,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select a,j.revision,true;
end;
$$;

create function graftvision_private.finalize_real_reconstruction_output(
  p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_artifact_id uuid,
  p_point_count integer,p_vertex_count integer,p_face_count integer,p_bounding_box_min numeric[],p_bounding_box_max numeric[],p_sparse_or_dense text,p_idempotency_key uuid
) returns table(output_manifest_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; x public.reconstruction_output_idempotency%rowtype; a public.reconstruction_artifact%rowtype; m public.reconstruction_prepared_manifest%rowtype; oid uuid; h text;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or exists(select 1 from public.reconstruction_output_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count) then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_INVALID'; end if;
  select * into strict a from public.reconstruction_artifact where id=p_artifact_id and reconstruction_job_id=j.id and attempt_count=j.attempt_count;
  if (a.artifact_type='sparse_point_cloud' and (a.mime_type<>'application/ply' or a.execution_mode not in ('sparse_cpu','dense_cuda') or p_point_count<=0 or p_sparse_or_dense<>'sparse')) or (a.artifact_type='dense_point_cloud' and (a.mime_type<>'application/ply' or a.execution_mode<>'dense_cuda' or p_point_count<=0 or p_sparse_or_dense<>'dense')) or (a.artifact_type='surface_mesh' and (a.mime_type not in ('model/gltf-binary','model/obj') or a.execution_mode<>'dense_cuda' or p_vertex_count<=0 or p_face_count<=0 or p_sparse_or_dense<>'dense')) then null; else raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_INVALID'; end if;
  if cardinality(p_bounding_box_min)<>3 or cardinality(p_bounding_box_max)<>3 then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_INVALID'; end if;
  h:=concat_ws(':',p_artifact_id::text,p_point_count,p_vertex_count,p_face_count,p_sparse_or_dense);
  select * into x from public.reconstruction_output_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if x.operation<>'finalize_output' or x.payload_hash<>h then raise exception using errcode='40001',message='RECONSTRUCTION_OUTPUT_IDEMPOTENCY_MISMATCH'; end if; return query select x.output_manifest_id,j.revision,false; return; end if;
  select * into strict m from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_artifact_geometry(artifact_id,point_count,vertex_count,face_count,bounding_box_min,bounding_box_max,coordinate_system_code,unit_code,validation_status,sparse_or_dense) values(p_artifact_id,p_point_count,p_vertex_count,p_face_count,p_bounding_box_min,p_bounding_box_max,'RIGHT_HANDED_Y_UP','MILLIMETRE','valid',p_sparse_or_dense);
  insert into public.reconstruction_output_manifest(clinic_id,patient_id,consultation_id,scan_session_id,analyzer_handoff_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_ids,engine_name,engine_version,adapter_version,configuration_version,execution_mode,vertex_count,face_count,point_count,bounding_box_mm) select j.clinic_id,j.patient_id,j.consultation_id,j.scan_session_id,im.analyzer_handoff_id,j.id,j.attempt_count,m.id,array[p_artifact_id],a.engine_name,a.engine_version,a.adapter_version,a.configuration_version,a.execution_mode,p_vertex_count,p_face_count,p_point_count,p_bounding_box_max from public.reconstruction_input_manifest im where im.id=j.manifest_id returning id into oid;
-- graftvision:dangerous-sql-approved task=RECON-004
-- graftvision:dangerous-sql-reason A valid leased real-engine artifact may atomically complete only its matching reconstruction attempt.
-- graftvision:corrective-plan Forward-fix with an additive migration; artifact and geometry evidence remain immutable.
  update public.reconstruction_job set state='succeeded',revision=revision+1,progress_percentage=100,progress_stage='completed',completed_at=clock_timestamp(),worker_lease_owner=null,lease_expires_at=null,updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_output_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,output_manifest_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'finalize_output',h,oid);
  insert into public.reconstruction_output_event(clinic_id,reconstruction_job_id,attempt_count,event_type,revision,progress_stage,worker_id) values(j.clinic_id,j.id,j.attempt_count,'output_manifest_created',j.revision,'completed',p_worker_id),(j.clinic_id,j.id,j.attempt_count,'execution_succeeded',j.revision,'completed',p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.output_manifest_created','reconstruction_output_manifest',oid,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision)),('clinic',j.clinic_id,'system','reconstruction.execution_succeeded','reconstruction_job',j.id,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select oid,j.revision,true;
end;
$$;

revoke all on function graftvision_private.record_real_reconstruction_artifact(uuid,uuid,integer,integer,uuid,text,text,text,integer,text,text,text,text,text,uuid), graftvision_private.finalize_real_reconstruction_output(uuid,uuid,integer,integer,uuid,integer,integer,integer,numeric[],numeric[],text,uuid) from public, anon, authenticated;

-- This D1 contract extension does not grant worker access or replace existing synthetic functions.
