-- SCAN-005D: an append-only readiness acknowledgement; no analyzer is started here.
create table public.scan_analyzer_handoff (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null,
  scan_session_id uuid not null references public.scan_session(id),
  quality_review_id uuid not null references public.scan_capture_quality_review(id),
  quality_review_revision integer not null check (quality_review_revision > 0),
  asset_ids uuid[] not null check (cardinality(asset_ids) = 7),
  quality_result_ids uuid[] not null check (cardinality(quality_result_ids) = 7),
  handoff_state text not null default 'created' check (handoff_state = 'created'),
  created_by uuid not null references public.platform_user(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (scan_session_id, quality_review_revision)
);
create table public.scan_analyzer_handoff_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  idempotency_key uuid not null,
  scan_session_id uuid not null references public.scan_session(id),
  expected_quality_review_revision integer not null,
  handoff_id uuid not null references public.scan_analyzer_handoff(id),
  primary key (clinic_id, actor_platform_user_id, idempotency_key)
);
alter table public.scan_analyzer_handoff enable row level security;
alter table public.scan_analyzer_handoff force row level security;
alter table public.scan_analyzer_handoff_idempotency enable row level security;
alter table public.scan_analyzer_handoff_idempotency force row level security;
revoke all on public.scan_analyzer_handoff, public.scan_analyzer_handoff_idempotency from public, anon, authenticated;
create trigger scan_analyzer_handoff_controlled before insert or update or delete on public.scan_analyzer_handoff for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger scan_analyzer_handoff_idempotency_controlled before insert or update or delete on public.scan_analyzer_handoff_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

do $$
declare validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into validator_definition;
  if position('''scan_quality.analyzer_handoff_created''' in validator_definition) = 0 then
    validator_definition := replace(validator_definition, '''scan_quality.override_recorded''', '''scan_quality.override_recorded'', ''scan_quality.analyzer_handoff_created''');
    execute validator_definition;
  end if;
end;
$$;

do $$
declare validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_resource_type(text)'::regprocedure) into validator_definition;
  if position('''scan_analyzer_handoff''' in validator_definition) = 0 then
    validator_definition := replace(validator_definition, '''scan_capture_quality_result''', '''scan_capture_quality_result'', ''scan_analyzer_handoff''');
    execute validator_definition;
  end if;
end;
$$;

create function graftvision_private.create_scan_analyzer_handoff(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid,
  p_expected_quality_review_revision integer, p_idempotency_key uuid
)
returns table (handoff_id uuid, quality_review_revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_session public.scan_session%rowtype; v_review public.scan_capture_quality_review%rowtype;
  v_existing public.scan_analyzer_handoff_idempotency%rowtype; v_handoff_id uuid; v_assets uuid[]; v_results uuid[];
begin
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,p_scan_session_id);
  if not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,(select consultation_id from public.scan_session where id=p_scan_session_id),'CONSULT-PERM-001') then
    raise exception using errcode='42501', message='SCAN_ANALYZER_HANDOFF_DENIED';
  end if;
  select * into v_existing from public.scan_analyzer_handoff_idempotency where clinic_id=v_context.clinic_id and actor_platform_user_id=v_context.actor_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.scan_session_id<>p_scan_session_id or v_existing.expected_quality_review_revision<>p_expected_quality_review_revision then raise exception using errcode='40001',message='SCAN_ANALYZER_HANDOFF_IDEMPOTENCY_MISMATCH'; end if;
    return query select v_existing.handoff_id,v_existing.expected_quality_review_revision,false; return;
  end if;
  select * into strict v_session from public.scan_session where id=p_scan_session_id and clinic_id=v_context.clinic_id;
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled handoff locks the current quality review before binding immutable evidence.
-- graftvision:corrective-plan Forward-fix through an additive migration; the handoff event remains append-only.
  select * into strict v_review from public.scan_capture_quality_review where scan_session_id=p_scan_session_id and clinic_id=v_context.clinic_id for update;
  if v_review.revision<>p_expected_quality_review_revision or not graftvision_private.read_scan_package_readiness(p_scan_session_id) then raise exception using errcode='40001',message='SCAN_ANALYZER_HANDOFF_NOT_READY'; end if;
  select array_agg(qc.asset_id order by qc.capture_step), array_agg(qc.current_result_id order by qc.capture_step) into v_assets,v_results from public.scan_capture_quality_current qc where qc.review_id=v_review.id and qc.scan_session_id=p_scan_session_id;
  if cardinality(v_assets)<>7 or cardinality(v_results)<>7 then raise exception using errcode='40001',message='SCAN_ANALYZER_HANDOFF_NOT_READY'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.scan_analyzer_handoff(clinic_id,patient_id,consultation_id,scan_session_id,quality_review_id,quality_review_revision,asset_ids,quality_result_ids,created_by) values(v_context.clinic_id,v_session.patient_id,v_session.consultation_id,p_scan_session_id,v_review.id,v_review.revision,v_assets,v_results,v_context.actor_id) returning id into v_handoff_id;
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',v_context.clinic_id,v_context.actor_id,'user','scan_quality.analyzer_handoff_created','scan_analyzer_handoff',v_handoff_id,'success',p_idempotency_key,'database',jsonb_build_object('scan_session_id',p_scan_session_id,'result_revision',v_review.revision));
  insert into public.scan_analyzer_handoff_idempotency(clinic_id,actor_platform_user_id,idempotency_key,scan_session_id,expected_quality_review_revision,handoff_id) values(v_context.clinic_id,v_context.actor_id,p_idempotency_key,p_scan_session_id,p_expected_quality_review_revision,v_handoff_id);
  return query select v_handoff_id,v_review.revision,true;
end;
$$;
revoke all on function graftvision_private.create_scan_analyzer_handoff(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
