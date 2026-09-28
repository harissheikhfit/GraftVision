-- RECON-001: immutable reconstruction input packages and controlled worker jobs.
create table public.reconstruction_input_manifest (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  scan_session_id uuid not null references public.scan_session(id),
  analyzer_handoff_id uuid not null unique references public.scan_analyzer_handoff(id),
  quality_review_revision integer not null check (quality_review_revision > 0),
  asset_ids uuid[] not null check (cardinality(asset_ids) = 7),
  quality_result_ids uuid[] not null check (cardinality(quality_result_ids) = 7),
  validator_versions text[] not null check (cardinality(validator_versions) = 7),
  manifest_version integer not null default 1 check (manifest_version = 1),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id)
);

create table public.reconstruction_job (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  scan_session_id uuid not null references public.scan_session(id),
  manifest_id uuid not null unique references public.reconstruction_input_manifest(id),
  state text not null default 'queued' check (state in ('queued','running','succeeded','failed','cancelled')),
  revision integer not null default 1 check (revision > 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  progress_stage text not null default 'validating_input' check (progress_stage in ('validating_input','preparing_assets','normalizing_images','reconstruction_pending','reconstruction_running','finalizing','completed')),
  worker_lease_owner uuid,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text check (failure_code is null or failure_code in ('INPUT_MANIFEST_INVALID','REQUIRED_ASSET_MISSING','ASSET_UNAVAILABLE','ASSET_INTEGRITY_FAILED','WORKER_TIMEOUT','WORKER_CRASHED','PROCESSING_FAILED','RETRY_LIMIT_REACHED','CANCELLED_BY_DOCTOR','SYSTEM_RECOVERY')),
  retry_after timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((worker_lease_owner is null) = (lease_expires_at is null))
);

create table public.reconstruction_job_event (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.reconstruction_job(id),
  clinic_id uuid not null references public.clinic(id),
  event_type text not null check (event_type in ('created','claimed','heartbeat','progressed','succeeded','failed','retried','cancelled')),
  prior_state text,
  new_state text not null check (new_state in ('queued','running','succeeded','failed','cancelled')),
  revision integer not null check (revision > 0),
  attempt_count integer not null check (attempt_count >= 0),
  progress_percentage integer not null check (progress_percentage between 0 and 100),
  progress_stage text not null check (progress_stage in ('validating_input','preparing_assets','normalizing_images','reconstruction_pending','reconstruction_running','finalizing','completed')),
  failure_code text check (failure_code is null or failure_code in ('INPUT_MANIFEST_INVALID','REQUIRED_ASSET_MISSING','ASSET_UNAVAILABLE','ASSET_INTEGRITY_FAILED','WORKER_TIMEOUT','WORKER_CRASHED','PROCESSING_FAILED','RETRY_LIMIT_REACHED','CANCELLED_BY_DOCTOR','SYSTEM_RECOVERY')),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_platform_user_id uuid references public.platform_user(id),
  worker_id uuid
);

create table public.reconstruction_job_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  idempotency_key uuid not null,
  operation text not null check (operation in ('create','retry','cancel')),
  job_id uuid not null references public.reconstruction_job(id),
  expected_revision integer not null,
  payload_hash text not null,
  primary key (clinic_id, actor_platform_user_id, idempotency_key)
);

alter table public.reconstruction_input_manifest enable row level security;
alter table public.reconstruction_input_manifest force row level security;
alter table public.reconstruction_job enable row level security;
alter table public.reconstruction_job force row level security;
alter table public.reconstruction_job_event enable row level security;
alter table public.reconstruction_job_event force row level security;
alter table public.reconstruction_job_idempotency enable row level security;
alter table public.reconstruction_job_idempotency force row level security;
revoke all on public.reconstruction_input_manifest, public.reconstruction_job, public.reconstruction_job_event, public.reconstruction_job_idempotency from public, anon, authenticated;
create trigger reconstruction_input_manifest_controlled before insert or update or delete on public.reconstruction_input_manifest for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_job_controlled before insert or update or delete on public.reconstruction_job for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_job_event_controlled before insert or update or delete on public.reconstruction_job_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger reconstruction_job_idempotency_controlled before insert or update or delete on public.reconstruction_job_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

do $$
declare definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into definition;
  if position('''reconstruction.job_created''' in definition) = 0 then
    definition := replace(definition, '''scan_quality.analyzer_handoff_created''', '''scan_quality.analyzer_handoff_created'', ''reconstruction.manifest_created'', ''reconstruction.job_created'', ''reconstruction.job_claimed'', ''reconstruction.job_progressed'', ''reconstruction.job_succeeded'', ''reconstruction.job_failed'', ''reconstruction.job_retried'', ''reconstruction.job_cancelled''');
    execute definition;
  end if;
  select pg_get_functiondef('graftvision_private.is_valid_audit_resource_type(text)'::regprocedure) into definition;
  if position('''reconstruction_job''' in definition) = 0 then
    definition := replace(definition, '''scan_analyzer_handoff''', '''scan_analyzer_handoff'', ''reconstruction_input_manifest'', ''reconstruction_job''');
    execute definition;
  end if;
end;
$$;

create function graftvision_private.require_reconstruction_worker(p_worker_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_worker_id is null or current_setting('graftvision.reconstruction_worker', true) <> 'on' then
    raise exception using errcode='42501', message='RECONSTRUCTION_WORKER_DENIED';
  end if;
end;
$$;

create function graftvision_private.create_reconstruction_job(
  p_session_id uuid, p_provider_identity_id uuid, p_handoff_id uuid,
  p_expected_quality_review_revision integer, p_idempotency_key uuid
) returns table(job_id uuid, manifest_id uuid, revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare c record; h public.scan_analyzer_handoff%rowtype; m uuid; j uuid; existing public.reconstruction_job_idempotency%rowtype; versions text[]; session_row public.scan_session%rowtype;
begin
  select ss.id as scan_session_id into strict session_row from public.scan_analyzer_handoff h join public.scan_session ss on ss.id=h.scan_session_id where h.id=p_handoff_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,session_row.id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,(select consultation_id from public.scan_session where id=session_row.id),'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  select * into existing from public.reconstruction_job_idempotency where clinic_id=c.clinic_id and actor_platform_user_id=c.actor_id and idempotency_key=p_idempotency_key;
  if found then
    if existing.operation<>'create' or existing.expected_revision<>p_expected_quality_review_revision then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_IDEMPOTENCY_MISMATCH'; end if;
    return query select existing.job_id,(select manifest_id from public.reconstruction_job where id=existing.job_id),existing.expected_revision,false; return;
  end if;
  select * into strict h from public.scan_analyzer_handoff where id=p_handoff_id and clinic_id=c.clinic_id for update;
  if h.quality_review_revision<>p_expected_quality_review_revision or not graftvision_private.read_scan_package_readiness(h.scan_session_id) then raise exception using errcode='40001',message='RECONSTRUCTION_INPUT_NOT_READY'; end if;
  if exists(select 1 from public.reconstruction_job r where r.manifest_id in (select id from public.reconstruction_input_manifest where analyzer_handoff_id=h.id)) then raise exception using errcode='23505',message='RECONSTRUCTION_JOB_ALREADY_EXISTS'; end if;
  select array_agg(distinct qr.validator_version order by qr.validator_version) into versions from public.scan_capture_quality_result qr where qr.id=any(h.quality_result_ids);
  if cardinality(versions) is null then raise exception using errcode='40001',message='RECONSTRUCTION_INPUT_MANIFEST_INVALID'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.reconstruction_input_manifest(clinic_id,patient_id,consultation_id,scan_session_id,analyzer_handoff_id,quality_review_revision,asset_ids,quality_result_ids,validator_versions,created_by) values(h.clinic_id,h.patient_id,h.consultation_id,h.scan_session_id,h.id,h.quality_review_revision,h.asset_ids,h.quality_result_ids,versions,c.actor_id) returning id into m;
  insert into public.reconstruction_job(clinic_id,patient_id,consultation_id,scan_session_id,manifest_id) values(h.clinic_id,h.patient_id,h.consultation_id,h.scan_session_id,m) returning id into j;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,new_state,revision,attempt_count,progress_percentage,progress_stage,actor_platform_user_id) values(j,h.clinic_id,'created','queued',1,0,0,'validating_input',c.actor_id);
  insert into public.reconstruction_job_idempotency(clinic_id,actor_platform_user_id,idempotency_key,operation,job_id,expected_revision,payload_hash) values(c.clinic_id,c.actor_id,p_idempotency_key,'create',j,p_expected_quality_review_revision,p_handoff_id::text);
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',c.clinic_id,c.actor_id,'user','reconstruction.manifest_created','reconstruction_input_manifest',m,'success',p_idempotency_key,'database',jsonb_build_object('scan_session_id',h.scan_session_id,'result_revision',h.quality_review_revision));
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',c.clinic_id,c.actor_id,'user','reconstruction.job_created','reconstruction_job',j,'success',p_idempotency_key,'database',jsonb_build_object('scan_session_id',h.scan_session_id,'result_revision',1));
  return query select j,m,1,true;
end;
$$;

create function graftvision_private.claim_reconstruction_job(p_job_id uuid,p_worker_id uuid,p_expected_revision integer)
returns table(job_id uuid, revision integer, attempt_count integer, lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; now_at timestamptz:=clock_timestamp();
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.revision<>p_expected_revision or (j.state not in ('queued','running')) or (j.state='running' and j.lease_expires_at>now_at) or j.attempt_count>=j.max_attempts then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_CLAIM_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason A claimed job gets one exclusive bounded lease and one attempt increment.
-- graftvision:corrective-plan Forward-fix with an additive migration; lifecycle events remain immutable.
  update public.reconstruction_job set state='running',revision=revision+1,attempt_count=attempt_count+1,worker_lease_owner=p_worker_id,lease_expires_at=now_at+interval '60 seconds',last_heartbeat_at=now_at,started_at=coalesce(started_at,now_at),updated_at=now_at where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,worker_id) values(j.id,j.clinic_id,'claimed','queued','running',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.job_claimed','reconstruction_job',j.id,'success',gen_random_uuid(),'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.attempt_count,j.lease_expires_at;
end;
$$;

create function graftvision_private.read_reconstruction_job_status(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid)
returns table(job_id uuid,manifest_id uuid,revision integer,state text,attempt_count integer,progress_percentage integer,progress_stage text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,failure_code text,retry_eligible boolean,cancellation_eligible boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; c record;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  return query select j.id,j.manifest_id,j.revision,j.state,j.attempt_count,j.progress_percentage,j.progress_stage,j.created_at,j.started_at,j.completed_at,j.failure_code,(j.state='failed' and j.attempt_count<j.max_attempts),(j.state in ('queued','running'));
end;
$$;

create function graftvision_private.renew_reconstruction_job_lease(p_job_id uuid,p_worker_id uuid,p_expected_revision integer)
returns table(job_id uuid,revision integer,lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; now_at timestamptz:=clock_timestamp();
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.state<>'running' or j.worker_lease_owner<>p_worker_id or j.revision<>p_expected_revision or j.lease_expires_at<=now_at then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_LEASE_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason A worker may renew only its current unexpired exclusive lease.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set revision=revision+1,lease_expires_at=now_at+interval '60 seconds',last_heartbeat_at=now_at,updated_at=now_at where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,worker_id) values(j.id,j.clinic_id,'heartbeat','running','running',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,p_worker_id);
  return query select j.id,j.revision,j.lease_expires_at;
end;
$$;

create function graftvision_private.update_reconstruction_job_progress(p_job_id uuid,p_worker_id uuid,p_expected_revision integer,p_progress_percentage integer,p_progress_stage text)
returns table(job_id uuid,revision integer,progress_percentage integer,progress_stage text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.state<>'running' or j.worker_lease_owner<>p_worker_id or j.lease_expires_at<=clock_timestamp() or j.revision<>p_expected_revision or p_progress_percentage<j.progress_percentage or p_progress_percentage>100 or p_progress_stage not in ('validating_input','preparing_assets','normalizing_images','reconstruction_pending','reconstruction_running','finalizing') then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_PROGRESS_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason Progress is monotonic within one actively leased attempt.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set revision=revision+1,progress_percentage=p_progress_percentage,progress_stage=p_progress_stage,updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,worker_id) values(j.id,j.clinic_id,'progressed','running','running',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.job_progressed','reconstruction_job',j.id,'success',gen_random_uuid(),'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.progress_percentage,j.progress_stage;
end;
$$;

create function graftvision_private.complete_reconstruction_job(p_job_id uuid,p_worker_id uuid,p_expected_revision integer)
returns table(job_id uuid,revision integer,state text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.state<>'running' or j.worker_lease_owner<>p_worker_id or j.lease_expires_at<=clock_timestamp() or j.revision<>p_expected_revision then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_COMPLETE_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason Completion is restricted to the worker holding the live exclusive lease.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set state='succeeded',revision=revision+1,progress_percentage=100,progress_stage='completed',worker_lease_owner=null,lease_expires_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,worker_id) values(j.id,j.clinic_id,'succeeded','running','succeeded',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.job_succeeded','reconstruction_job',j.id,'success',gen_random_uuid(),'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.state;
end;
$$;

create function graftvision_private.fail_reconstruction_job(p_job_id uuid,p_worker_id uuid,p_expected_revision integer,p_failure_code text)
returns table(job_id uuid,revision integer,state text)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype;
begin
  perform graftvision_private.require_reconstruction_worker(p_worker_id);
  select * into strict j from public.reconstruction_job where id=p_job_id for update;
  if j.state<>'running' or j.worker_lease_owner<>p_worker_id or j.revision<>p_expected_revision or p_failure_code not in ('INPUT_MANIFEST_INVALID','REQUIRED_ASSET_MISSING','ASSET_UNAVAILABLE','ASSET_INTEGRITY_FAILED','WORKER_TIMEOUT','WORKER_CRASHED','PROCESSING_FAILED','RETRY_LIMIT_REACHED','SYSTEM_RECOVERY') then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_FAILURE_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason A worker failure closes its live attempt without disclosing internal diagnostics.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set state='failed',revision=revision+1,failure_code=p_failure_code,worker_lease_owner=null,lease_expires_at=null,retry_after=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,failure_code,worker_id) values(j.id,j.clinic_id,'failed','running','failed',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,j.failure_code,p_worker_id);
  insert into public.audit_event(audit_scope,clinic_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,'system','reconstruction.job_failed','reconstruction_job',j.id,'failure',gen_random_uuid(),'system',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.state;
end;
$$;

create function graftvision_private.read_reconstruction_manifest_summary(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid)
returns table(manifest_id uuid,manifest_version integer,quality_review_revision integer,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; c record;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  return query select m.id,m.manifest_version,m.quality_review_revision,m.created_at from public.reconstruction_input_manifest m where m.id=j.manifest_id;
end;
$$;

create function graftvision_private.retry_reconstruction_job(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid,p_expected_revision integer,p_idempotency_key uuid)
returns table(job_id uuid,revision integer,state text,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; c record; existing public.reconstruction_job_idempotency%rowtype;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  select * into existing from public.reconstruction_job_idempotency where clinic_id=c.clinic_id and actor_platform_user_id=c.actor_id and idempotency_key=p_idempotency_key;
  if found then
    if existing.operation<>'retry' or existing.job_id<>p_job_id or existing.expected_revision<>p_expected_revision then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_IDEMPOTENCY_MISMATCH'; end if;
    return query select j.id,j.revision,j.state,false; return;
  end if;
  select * into strict j from public.reconstruction_job where id=p_job_id and clinic_id=c.clinic_id for update;
  if j.state<>'failed' or j.revision<>p_expected_revision or j.attempt_count>=j.max_attempts or coalesce(j.retry_after,clock_timestamp())>clock_timestamp() then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_RETRY_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason A verified Doctor may queue one eligible failed job without resetting prior attempt evidence.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set state='queued',revision=revision+1,progress_percentage=0,progress_stage='validating_input',failure_code=null,retry_after=null,updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,actor_platform_user_id) values(j.id,j.clinic_id,'retried','failed','queued',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,c.actor_id);
  insert into public.reconstruction_job_idempotency(clinic_id,actor_platform_user_id,idempotency_key,operation,job_id,expected_revision,payload_hash) values(c.clinic_id,c.actor_id,p_idempotency_key,'retry',j.id,p_expected_revision,j.id::text);
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,c.actor_id,'user','reconstruction.job_retried','reconstruction_job',j.id,'success',p_idempotency_key,'database',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.state,true;
end;
$$;

create function graftvision_private.cancel_reconstruction_job(p_session_id uuid,p_provider_identity_id uuid,p_job_id uuid,p_expected_revision integer,p_idempotency_key uuid)
returns table(job_id uuid,revision integer,state text,is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare j public.reconstruction_job%rowtype; c record; existing public.reconstruction_job_idempotency%rowtype;
begin
  select * into strict j from public.reconstruction_job where id=p_job_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,j.scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,j.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='RECONSTRUCTION_JOB_DENIED'; end if;
  select * into existing from public.reconstruction_job_idempotency where clinic_id=c.clinic_id and actor_platform_user_id=c.actor_id and idempotency_key=p_idempotency_key;
  if found then
    if existing.operation<>'cancel' or existing.job_id<>p_job_id or existing.expected_revision<>p_expected_revision then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_IDEMPOTENCY_MISMATCH'; end if;
    return query select j.id,j.revision,j.state,false; return;
  end if;
  select * into strict j from public.reconstruction_job where id=p_job_id and clinic_id=c.clinic_id for update;
  if j.state not in ('queued','running') or j.revision<>p_expected_revision then raise exception using errcode='40001',message='RECONSTRUCTION_JOB_CANCEL_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
-- graftvision:dangerous-sql-approved task=RECON-001
-- graftvision:dangerous-sql-reason A verified Doctor can cancel only an active queued or leased job.
-- graftvision:corrective-plan Forward-fix with an additive migration; immutable lifecycle events retain evidence.
  update public.reconstruction_job set state='cancelled',revision=revision+1,failure_code='CANCELLED_BY_DOCTOR',worker_lease_owner=null,lease_expires_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
  select * into j from public.reconstruction_job where id=p_job_id;
  insert into public.reconstruction_job_event(job_id,clinic_id,event_type,prior_state,new_state,revision,attempt_count,progress_percentage,progress_stage,failure_code,actor_platform_user_id) values(j.id,j.clinic_id,'cancelled','queued','cancelled',j.revision,j.attempt_count,j.progress_percentage,j.progress_stage,j.failure_code,c.actor_id);
  insert into public.reconstruction_job_idempotency(clinic_id,actor_platform_user_id,idempotency_key,operation,job_id,expected_revision,payload_hash) values(c.clinic_id,c.actor_id,p_idempotency_key,'cancel',j.id,p_expected_revision,j.id::text);
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',j.clinic_id,c.actor_id,'user','reconstruction.job_cancelled','reconstruction_job',j.id,'success',p_idempotency_key,'database',jsonb_build_object('scan_session_id',j.scan_session_id,'result_revision',j.revision));
  return query select j.id,j.revision,j.state,true;
end;
$$;

revoke all on function graftvision_private.create_reconstruction_job(uuid,uuid,uuid,integer,uuid), graftvision_private.claim_reconstruction_job(uuid,uuid,integer), graftvision_private.renew_reconstruction_job_lease(uuid,uuid,integer), graftvision_private.update_reconstruction_job_progress(uuid,uuid,integer,integer,text), graftvision_private.complete_reconstruction_job(uuid,uuid,integer), graftvision_private.fail_reconstruction_job(uuid,uuid,integer,text), graftvision_private.retry_reconstruction_job(uuid,uuid,uuid,integer,uuid), graftvision_private.cancel_reconstruction_job(uuid,uuid,uuid,integer,uuid), graftvision_private.read_reconstruction_job_status(uuid,uuid,uuid), graftvision_private.read_reconstruction_manifest_summary(uuid,uuid,uuid) from public, anon, authenticated;
