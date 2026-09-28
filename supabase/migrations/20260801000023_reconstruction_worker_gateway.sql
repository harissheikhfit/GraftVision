-- RECON-004D: server-only worker gateway; no clinic or patient data is projected.
create table public.reconstruction_worker_storage_grant (
  id uuid primary key default gen_random_uuid(),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  worker_id uuid not null,
  operation text not null check (operation in ('prepared_read','artifact_write')),
  prepared_asset_id uuid references public.reconstruction_prepared_asset(id),
  artifact_type text check (artifact_type in ('sparse_point_cloud','dense_point_cloud','surface_mesh','reconstruction_preview','bounded_metadata')),
  mime_type text check (mime_type in ('application/octet-stream','application/ply','model/obj','model/gltf-binary','application/json','image/png','image/webp')),
  object_reference uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (clock_timestamp() + interval '60 seconds'),
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check ((operation='prepared_read' and prepared_asset_id is not null and artifact_type is null and mime_type is null) or (operation='artifact_write' and prepared_asset_id is null and artifact_type is not null and mime_type is not null)),
  unique (object_reference)
);
alter table public.reconstruction_worker_storage_grant enable row level security;
alter table public.reconstruction_worker_storage_grant force row level security;
revoke all on public.reconstruction_worker_storage_grant from public, anon, authenticated;
create trigger reconstruction_worker_storage_grant_controlled before insert or update or delete on public.reconstruction_worker_storage_grant for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.read_worker_reconstruction_context(p_job_id uuid,p_worker_id uuid,p_attempt_count integer)
returns table(job_id uuid,prepared_manifest_id uuid,attempt_count integer,revision integer,execution_mode text,engine_name text,engine_version text,adapter_version text,configuration_version text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if not exists(select 1 from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count) then raise exception using errcode='40001',message='PREPARED_MANIFEST_INVALID'; end if;
  return query select j.id,(select id from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count),j.attempt_count,j.revision,'dense_cuda'::text,'COLMAP'::text,'4.1.1'::text,'recon-colmap-adapter-v2'::text,'recon-colmap-config-v2'::text;
end;
$$;

create function graftvision_private.authorize_prepared_asset_access(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_prepared_asset_id uuid)
returns table(prepared_asset_id uuid,capture_step text,object_reference uuid,checksum text,mime_type text,width integer,height integer,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; a public.reconstruction_prepared_asset%rowtype; g public.reconstruction_worker_storage_grant%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  select * into strict a from public.reconstruction_prepared_asset where id=p_prepared_asset_id and reconstruction_job_id=j.id and attempt_count=j.attempt_count;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_worker_storage_grant(reconstruction_job_id,attempt_count,worker_id,operation,prepared_asset_id) values(j.id,j.attempt_count,p_worker_id,'prepared_read',a.id) returning * into g;
  return query select a.id,a.capture_step,a.normalized_object_reference,a.normalized_checksum,a.normalized_mime_type,a.normalized_width,a.normalized_height,g.expires_at;
end;
$$;

create function graftvision_private.authorize_reconstruction_artifact_upload(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_artifact_type text,p_mime_type text)
returns table(object_reference uuid,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; g public.reconstruction_worker_storage_grant%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if not ((p_artifact_type='sparse_point_cloud' and p_mime_type='application/ply') or (p_artifact_type='dense_point_cloud' and p_mime_type='application/ply') or (p_artifact_type='surface_mesh' and p_mime_type in ('model/gltf-binary','model/obj')) or (p_artifact_type='reconstruction_preview' and p_mime_type in ('image/png','image/webp')) or (p_artifact_type='bounded_metadata' and p_mime_type='application/json')) then raise exception using errcode='40001',message='RECONSTRUCTION_ARTIFACT_INVALID'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_worker_storage_grant(reconstruction_job_id,attempt_count,worker_id,operation,artifact_type,mime_type) values(j.id,j.attempt_count,p_worker_id,'artifact_write',p_artifact_type,p_mime_type) returning * into g;
  return query select g.object_reference,g.expires_at;
end;
$$;

create function graftvision_private.read_worker_cancellation_state(p_job_id uuid,p_worker_id uuid,p_attempt_count integer)
returns table(cancelled boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id;
  if j.attempt_count<>p_attempt_count or (j.state='running' and j.worker_lease_owner<>p_worker_id) then raise exception using errcode='42501',message='RECONSTRUCTION_WORKER_INPUT_DENIED'; end if;
  return query select j.state='cancelled';
end;
$$;

create function graftvision_private.record_worker_reconstruction_artifact(
  p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_prepared_manifest_id uuid,p_object_reference uuid,p_artifact_type text,p_checksum text,p_mime_type text,p_byte_size integer,p_engine_name text,p_engine_version text,p_adapter_version text,p_configuration_version text,p_execution_mode text,p_idempotency_key uuid
) returns table(artifact_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare r record; g public.reconstruction_worker_storage_grant%rowtype;
begin
  select * into strict g from public.reconstruction_worker_storage_grant where object_reference=p_object_reference and reconstruction_job_id=p_job_id and attempt_count=p_attempt_count and worker_id=p_worker_id and operation='artifact_write' and artifact_type=p_artifact_type and mime_type=p_mime_type and consumed_at is null and expires_at>clock_timestamp() for update;
  select * into r from graftvision_private.record_real_reconstruction_artifact(p_job_id,p_worker_id,p_attempt_count,p_expected_revision,p_prepared_manifest_id,p_artifact_type,p_checksum,p_mime_type,p_byte_size,p_engine_name,p_engine_version,p_adapter_version,p_configuration_version,p_execution_mode,p_idempotency_key);
  if r.is_new then
    perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-004
-- graftvision:dangerous-sql-reason A verified worker upload is bound atomically to its server-authorized object reference.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable artifact evidence is retained.
    update public.reconstruction_artifact set object_reference=p_object_reference where id=r.artifact_id;
-- graftvision:dangerous-sql-approved task=RECON-004
-- graftvision:dangerous-sql-reason A single-use storage grant is consumed only after its matching artifact is recorded.
-- graftvision:corrective-plan Forward-fix with an additive migration; expired or consumed grants remain unavailable.
    update public.reconstruction_worker_storage_grant set consumed_at=clock_timestamp() where id=g.id;
  end if;
  return query select r.artifact_id,r.revision,r.is_new;
end;
$$;

revoke all on function graftvision_private.read_worker_reconstruction_context(uuid,uuid,integer), graftvision_private.authorize_prepared_asset_access(uuid,uuid,integer,uuid), graftvision_private.authorize_reconstruction_artifact_upload(uuid,uuid,integer,text,text), graftvision_private.read_worker_cancellation_state(uuid,uuid,integer), graftvision_private.record_worker_reconstruction_artifact(uuid,uuid,integer,integer,uuid,uuid,text,text,text,integer,text,text,text,text,text,uuid) from public, anon, authenticated;
