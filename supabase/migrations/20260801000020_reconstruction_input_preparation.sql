-- RECON-002: lease-scoped deterministic preparation metadata; no reconstruction engine is invoked.
create table public.reconstruction_prepared_asset (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  source_asset_id uuid not null references public.scan_capture_asset(id),
  capture_step text not null check (capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  source_checksum text not null check (source_checksum ~ '^[A-Fa-f0-9]{64}$'),
  normalized_object_reference uuid not null default gen_random_uuid(),
  normalized_checksum text not null check (normalized_checksum ~ '^[A-Fa-f0-9]{64}$'),
  normalized_width integer not null check (normalized_width >= 256),
  normalized_height integer not null check (normalized_height >= 256),
  normalized_mime_type text not null check (normalized_mime_type = 'image/jpeg'),
  pipeline_version text not null check (pipeline_version = 'recon-input-prep-v1'),
  created_at timestamptz not null default clock_timestamp(),
  unique (reconstruction_job_id, attempt_count, source_asset_id, pipeline_version),
  unique (reconstruction_job_id, attempt_count, capture_step, pipeline_version)
);

create table public.reconstruction_prepared_manifest (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  source_manifest_id uuid not null references public.reconstruction_input_manifest(id),
  pipeline_version text not null check (pipeline_version = 'recon-input-prep-v1'),
  prepared_asset_ids uuid[] not null check (cardinality(prepared_asset_ids) = 7),
  created_at timestamptz not null default clock_timestamp(),
  unique (reconstruction_job_id, attempt_count, pipeline_version)
);

create table public.reconstruction_preparation_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  event_type text not null check (event_type in ('input_accessed','asset_normalized','manifest_created','preparation_failed')),
  capture_step text check (capture_step is null or capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  pipeline_version text not null check (pipeline_version = 'recon-input-prep-v1'),
  revision integer not null check (revision > 0),
  failure_code text check (failure_code is null or failure_code in ('INPUT_MANIFEST_INVALID','REQUIRED_ASSET_MISSING','ASSET_UNAVAILABLE','ASSET_INTEGRITY_FAILED','WORKER_TIMEOUT','WORKER_CRASHED','PROCESSING_FAILED','RETRY_LIMIT_REACHED','CANCELLED_BY_DOCTOR','SYSTEM_RECOVERY')),
  occurred_at timestamptz not null default clock_timestamp(),
  worker_id uuid not null
);

create table public.reconstruction_preparation_idempotency (
  reconstruction_job_id uuid not null references public.reconstruction_job(id),
  attempt_count integer not null check (attempt_count > 0),
  worker_id uuid not null,
  idempotency_key uuid not null,
  operation text not null check (operation in ('normalize_asset','finalize_manifest')),
  payload_hash text not null,
  prepared_asset_id uuid references public.reconstruction_prepared_asset(id),
  prepared_manifest_id uuid references public.reconstruction_prepared_manifest(id),
  primary key (reconstruction_job_id, attempt_count, worker_id, idempotency_key)
);

alter table public.reconstruction_prepared_asset enable row level security;
alter table public.reconstruction_prepared_asset force row level security;
alter table public.reconstruction_prepared_manifest enable row level security;
alter table public.reconstruction_prepared_manifest force row level security;
alter table public.reconstruction_preparation_event enable row level security;
alter table public.reconstruction_preparation_event force row level security;
alter table public.reconstruction_preparation_idempotency enable row level security;
alter table public.reconstruction_preparation_idempotency force row level security;
revoke all on public.reconstruction_prepared_asset, public.reconstruction_prepared_manifest, public.reconstruction_preparation_event, public.reconstruction_preparation_idempotency from public, anon, authenticated;
create trigger reconstruction_prepared_asset_controlled before insert or update or delete on public.reconstruction_prepared_asset for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_prepared_manifest_controlled before insert or update or delete on public.reconstruction_prepared_manifest for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_preparation_event_controlled before insert or update or delete on public.reconstruction_preparation_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_preparation_idempotency_controlled before insert or update or delete on public.reconstruction_preparation_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

do $$
declare definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into definition;
  if position('''reconstruction.input_accessed''' in definition) = 0 then
    definition := replace(definition, '''reconstruction.job_cancelled''', '''reconstruction.job_cancelled'', ''reconstruction.input_accessed'', ''reconstruction.asset_normalized'', ''reconstruction.prepared_manifest_created'', ''reconstruction.preparation_failed''');
    execute definition;
  end if;
  select pg_get_functiondef('graftvision_private.is_valid_audit_resource_type(text)'::regprocedure) into definition;
  if position('''reconstruction_prepared_manifest''' in definition) = 0 then
    definition := replace(definition, '''reconstruction_job''', '''reconstruction_job'', ''reconstruction_prepared_asset'', ''reconstruction_prepared_manifest''');
    execute definition;
  end if;
end;
$$;

create function graftvision_private.require_reconstruction_job_lease(p_job_id uuid,p_worker_id uuid,p_attempt_count integer)
returns public.reconstruction_job language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.state<>'running' or j.worker_lease_owner<>p_worker_id or j.lease_expires_at<=clock_timestamp() or j.attempt_count<>p_attempt_count then raise exception using errcode='42501',message='RECONSTRUCTION_WORKER_INPUT_DENIED'; end if;
  return j;
end;
$$;

create function graftvision_private.read_reconstruction_worker_input(p_job_id uuid,p_worker_id uuid,p_attempt_count integer)
returns table(capture_step text,asset_id uuid,source_checksum text,source_mime_type text,source_byte_size bigint,source_width integer,source_height integer,pipeline_version text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if (select cardinality(asset_ids) from public.reconstruction_input_manifest where id=j.manifest_id)<>7 then raise exception using errcode='40001',message='RECONSTRUCTION_INPUT_MANIFEST_INVALID'; end if;
  insert into public.reconstruction_preparation_event(clinic_id,reconstruction_job_id,attempt_count,event_type,pipeline_version,revision,worker_id) values(j.clinic_id,j.id,j.attempt_count,'input_accessed','recon-input-prep-v1',j.revision,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.input_accessed','reconstruction_job',j.id,'success',gen_random_uuid(),'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select a.capture_step,a.id,a.checksum,a.mime_type,a.byte_size,a.width,a.height,'recon-input-prep-v1' from public.reconstruction_input_manifest m join public.scan_capture_asset a on a.id=any(m.asset_ids) where m.id=j.manifest_id and a.upload_status='uploaded' and a.scan_session_id=j.scan_session_id order by array_position(array['front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right'],a.capture_step);
end;
$$;

create function graftvision_private.record_reconstruction_prepared_asset(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_source_asset_id uuid,p_capture_step text,p_source_checksum text,p_normalized_checksum text,p_normalized_width integer,p_normalized_height integer,p_idempotency_key uuid)
returns table(prepared_asset_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; existing public.reconstruction_preparation_idempotency%rowtype; pid uuid; expected_asset public.scan_capture_asset%rowtype;
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision or p_capture_step not in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right') or p_normalized_width<256 or p_normalized_height<256 then raise exception using errcode='40001',message='RECONSTRUCTION_PREPARATION_CONFLICT'; end if;
  select * into existing from public.reconstruction_preparation_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if existing.operation<>'normalize_asset' or existing.payload_hash<>concat(p_source_asset_id::text,':',p_capture_step,':',p_normalized_checksum) then raise exception using errcode='40001',message='RECONSTRUCTION_PREPARATION_IDEMPOTENCY_MISMATCH'; end if; return query select existing.prepared_asset_id,j.revision,false; return; end if;
  select a.* into strict expected_asset from public.scan_capture_asset a join public.reconstruction_input_manifest m on a.id=any(m.asset_ids) where m.id=j.manifest_id and a.id=p_source_asset_id and a.capture_step=p_capture_step and a.upload_status='uploaded';
  if expected_asset.checksum<>p_source_checksum then raise exception using errcode='40001',message='ASSET_INTEGRITY_FAILED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_prepared_asset(clinic_id,reconstruction_job_id,attempt_count,source_asset_id,capture_step,source_checksum,normalized_checksum,normalized_width,normalized_height) values(j.clinic_id,j.id,j.attempt_count,p_source_asset_id,p_capture_step,p_source_checksum,p_normalized_checksum,p_normalized_width,p_normalized_height) returning id into pid;
  insert into public.reconstruction_preparation_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,prepared_asset_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'normalize_asset',concat(p_source_asset_id::text,':',p_capture_step,':',p_normalized_checksum),pid);
  insert into public.reconstruction_preparation_event(clinic_id,reconstruction_job_id,attempt_count,event_type,capture_step,pipeline_version,revision,worker_id) values(j.clinic_id,j.id,j.attempt_count,'asset_normalized',p_capture_step,'recon-input-prep-v1',j.revision,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.asset_normalized','reconstruction_prepared_asset',pid,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select pid,j.revision,true;
end;
$$;

create function graftvision_private.finalize_reconstruction_prepared_manifest(p_job_id uuid,p_worker_id uuid,p_attempt_count integer,p_expected_revision integer,p_idempotency_key uuid)
returns table(prepared_manifest_id uuid,revision integer,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; existing public.reconstruction_preparation_idempotency%rowtype; mid uuid; ids uuid[];
begin
  select * into strict j from graftvision_private.require_reconstruction_job_lease(p_job_id,p_worker_id,p_attempt_count);
  if j.revision<>p_expected_revision then raise exception using errcode='40001',message='RECONSTRUCTION_PREPARATION_CONFLICT'; end if;
  select * into existing from public.reconstruction_preparation_idempotency where reconstruction_job_id=j.id and attempt_count=j.attempt_count and worker_id=p_worker_id and idempotency_key=p_idempotency_key;
  if found then if existing.operation<>'finalize_manifest' then raise exception using errcode='40001',message='RECONSTRUCTION_PREPARATION_IDEMPOTENCY_MISMATCH'; end if; return query select existing.prepared_manifest_id,j.revision,false; return; end if;
  select array_agg(id order by capture_step) into ids from public.reconstruction_prepared_asset where reconstruction_job_id=j.id and attempt_count=j.attempt_count and pipeline_version='recon-input-prep-v1';
  if cardinality(ids)<>7 then raise exception using errcode='40001',message='REQUIRED_ASSET_MISSING'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_prepared_manifest(clinic_id,reconstruction_job_id,attempt_count,source_manifest_id,prepared_asset_ids) values(j.clinic_id,j.id,j.attempt_count,j.manifest_id,ids) returning id into mid;
  insert into public.reconstruction_preparation_idempotency(reconstruction_job_id,attempt_count,worker_id,idempotency_key,operation,payload_hash,prepared_manifest_id) values(j.id,j.attempt_count,p_worker_id,p_idempotency_key,'finalize_manifest',j.manifest_id::text,mid);
-- graftvision:dangerous-sql-approved task=RECON-002
-- graftvision:dangerous-sql-reason A live worker advances only its own job to the preparation boundary.
-- graftvision:corrective-plan Forward-fix with an additive migration; prepared manifests remain immutable.
  update public.reconstruction_job set revision=revision+1,progress_percentage=90,progress_stage='reconstruction_pending',updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_preparation_event(clinic_id,reconstruction_job_id,attempt_count,event_type,pipeline_version,revision,worker_id) values(j.clinic_id,j.id,j.attempt_count,'manifest_created','recon-input-prep-v1',j.revision,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.prepared_manifest_created','reconstruction_prepared_manifest',mid,'success',p_idempotency_key,'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select mid,j.revision,true;
end;
$$;

create function graftvision_private.read_reconstruction_preparation_status(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid)
returns table(preparation_state text,prepared_angle_count integer,required_angle_count integer,pipeline_version text,progress_stage text,failure_code text,created_at timestamptz,completed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; c record;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  return query select case when exists(select 1 from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count) then 'prepared' else j.state end,(select count(*)::integer from public.reconstruction_prepared_asset where reconstruction_job_id=j.id and attempt_count=j.attempt_count),7,'recon-input-prep-v1',j.progress_stage,j.failure_code,j.created_at,(select created_at from public.reconstruction_prepared_manifest where reconstruction_job_id=j.id and attempt_count=j.attempt_count);
end;
$$;

revoke all on function graftvision_private.require_reconstruction_job_lease(uuid,uuid,integer), graftvision_private.read_reconstruction_worker_input(uuid,uuid,integer), graftvision_private.record_reconstruction_prepared_asset(uuid,uuid,integer,integer,uuid,text,text,text,integer,integer,uuid), graftvision_private.finalize_reconstruction_prepared_manifest(uuid,uuid,integer,integer,uuid), graftvision_private.read_reconstruction_preparation_status(uuid,uuid,uuid) from public, anon, authenticated;
