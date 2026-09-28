-- Migration: SCAN-001 Scan Session Lifecycle
-- Adds public.scan_session and public.scan_session_event

create table public.scan_session (
  id uuid primary key default gen_random_uuid(),
  revision integer not null default 1,
  clinic_id uuid not null,
  patient_id uuid not null,
  consultation_id uuid not null,
  created_by uuid not null references public.platform_user(id) on delete restrict,
  status text not null check (status in ('created', 'paired', 'completed', 'revoked', 'expired')),
  token_hash text not null,
  pairing_nonce text,
  expires_at timestamptz not null,
  paired_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint scan_session_clinic_fk foreign key (clinic_id) references public.clinic(id) on delete restrict,
  constraint scan_session_patient_fk foreign key (patient_id) references public.patient(id) on delete restrict,
  constraint scan_session_consultation_fk foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id) on delete restrict
);

create index scan_session_clinic_patient_idx on public.scan_session (clinic_id, patient_id);
create index scan_session_consultation_idx on public.scan_session (clinic_id, consultation_id);
create unique index scan_session_token_hash_idx on public.scan_session (token_hash);

create table public.scan_session_event (
  id uuid primary key default gen_random_uuid(),
  scan_session_id uuid not null,
  clinic_id uuid not null,
  event_type text not null check (event_type in ('created', 'paired', 'completed', 'revoked', 'expired')),
  actor_platform_user_id uuid references public.platform_user(id) on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint scan_session_event_session_fk foreign key (scan_session_id) references public.scan_session(id) on delete cascade
);

create index scan_session_event_session_idx on public.scan_session_event (scan_session_id, occurred_at desc);

create table public.scan_operation_idempotency (
  clinic_id uuid not null,
  actor_platform_user_id uuid not null,
  request_family text not null,
  idempotency_key text not null,
  scan_session_id uuid not null,
  result_revision integer not null check (result_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_family, idempotency_key),
  constraint scan_operation_idempotency_session_fk
    foreign key (scan_session_id) references public.scan_session(id) on delete cascade
);

alter table public.scan_session enable row level security;
alter table public.scan_session force row level security;
alter table public.scan_session_event enable row level security;
alter table public.scan_session_event force row level security;
alter table public.scan_operation_idempotency enable row level security;
alter table public.scan_operation_idempotency force row level security;

revoke all on table public.scan_session from public, anon, authenticated;
revoke all on table public.scan_session_event from public, anon, authenticated;
revoke all on table public.scan_operation_idempotency from public, anon, authenticated;

-- Controlled mutation trigger
create function graftvision_private.enforce_controlled_scan_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.scan_controlled', true) <> 'on' then
    raise exception using errcode = '42501', message = 'SCAN_CONTROLLED_MUTATION_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function graftvision_private.enforce_controlled_scan_mutation() from public, anon, authenticated;

create trigger scan_session_controlled
before insert or update or delete on public.scan_session
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create trigger scan_session_event_controlled
before insert or update or delete on public.scan_session_event
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create trigger scan_operation_idempotency_controlled
before insert or update or delete on public.scan_operation_idempotency
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

-- RLS policies
-- 1. Scan session read
create policy scan_session_select on public.scan_session
  for select
  to authenticated
  using (
    clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_permission(
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id(),
      'CLINICAL-PERM-002'
    )
  );

-- 2. Scan session event read
create policy scan_session_event_select on public.scan_session_event
  for select
  to authenticated
  using (
    clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_permission(
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id(),
      'CLINICAL-PERM-002'
    )
  );

create function graftvision_private.create_scan_session(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_id uuid,
  p_patient_id uuid,
  p_consultation_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_idempotency_key text
)
returns table (
  scan_session_id uuid,
  revision integer,
  is_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing public.scan_operation_idempotency%rowtype;
  v_is_analyzer_ready boolean;
begin
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id
    and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';

  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'CLINICAL-PERM-002') then
    raise exception using errcode = '42501', message = 'INSUFFICIENT_CLINICAL_PERMISSION';
  end if;

  select * into v_existing from public.scan_operation_idempotency
  where clinic_id = v_clinic_id
    and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.create'
    and idempotency_key = p_idempotency_key;

  if found then
    return query select v_existing.scan_session_id, v_existing.result_revision, false;
    return;
  end if;

  select is_ready into v_is_analyzer_ready
  from graftvision_private.read_consultation_analyzer_readiness(v_clinic_id, p_consultation_id);
  
  if not coalesce(v_is_analyzer_ready, false) then
    raise exception using errcode = '42501', message = 'CONSULTATION_ANALYZER_NOT_READY';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);

  
  insert into public.scan_session (
    id, clinic_id, patient_id, consultation_id, created_by,
    status, token_hash, expires_at
  ) values (
    p_id, v_clinic_id, p_patient_id, p_consultation_id, v_actor_id,
    'created', p_token_hash, p_expires_at
  );

  
  insert into public.scan_session_event (
    scan_session_id, clinic_id, event_type, actor_platform_user_id
  ) values (
    p_id, v_clinic_id, 'created', v_actor_id
  );

  
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application
  ) values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'scan_session.create',
    'scan_session', p_id, 'success', p_idempotency_key::uuid, 'database'
  );

  
  insert into public.scan_operation_idempotency(
    clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision
  ) values (
    v_clinic_id, v_actor_id, 'scan_session.create', p_idempotency_key, p_id, 1
  );

  perform set_config('graftvision.scan_controlled', 'off', true);

  return query select p_id, 1, true;
end;
$$;
revoke all on function graftvision_private.create_scan_session(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text) from public, anon, authenticated;

create function graftvision_private.pair_scan_session(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid,
  p_pairing_nonce text,
  p_idempotency_key text
)
returns table (
  scan_session_id uuid,
  revision integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing_idempotency public.scan_operation_idempotency%rowtype;
  v_current public.scan_session%rowtype;
begin
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id
    and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';

  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'CLINICAL-PERM-002') then
    raise exception using errcode = '42501', message = 'INSUFFICIENT_CLINICAL_PERMISSION';
  end if;

  select * into v_existing_idempotency from public.scan_operation_idempotency
  where clinic_id = v_clinic_id
    and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.pair'
    and idempotency_key = p_idempotency_key;

  if found then
    return query select v_existing_idempotency.scan_session_id, v_existing_idempotency.result_revision, 'paired'::text;
    return;
  end if;

  select * into strict v_current
  from public.scan_session
  where id = p_scan_session_id and clinic_id = v_clinic_id
  for update; -- Serializable semantic via row lock

  if v_current.status <> 'created' then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;

  if v_current.expires_at <= clock_timestamp() then
    -- It's expired, update status and fail
    perform set_config('graftvision.scan_controlled', 'on', true);
    
-- graftvision:dangerous-sql-approved task=SCAN-001
-- graftvision:dangerous-sql-reason Controlled lifecycle transition update
-- graftvision:corrective-plan Immutability triggers are bypassed only inside this controlled mutation
    update public.scan_session
    set status = 'expired', updated_at = clock_timestamp(), revision = revision + 1
    where id = p_scan_session_id;

    
    insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
    values (p_scan_session_id, v_clinic_id, 'expired', null);

    perform set_config('graftvision.scan_controlled', 'off', true);
    raise exception using errcode = '40001', message = 'SCAN_SESSION_EXPIRED';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);

-- graftvision:dangerous-sql-approved task=SCAN-001
-- graftvision:dangerous-sql-reason Controlled lifecycle transition update
-- graftvision:corrective-plan Immutability triggers are bypassed only inside this controlled mutation
  update public.scan_session
  set status = 'paired', pairing_nonce = p_pairing_nonce, paired_at = clock_timestamp(), updated_at = clock_timestamp(), revision = revision + 1
  where id = p_scan_session_id;

  
  insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
  values (p_scan_session_id, v_clinic_id, 'paired', v_actor_id);

  
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application
  ) values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'scan_session.pair',
    'scan_session', p_scan_session_id, 'success', p_idempotency_key::uuid, 'database'
  );

  
  insert into public.scan_operation_idempotency(
    clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision
  ) values (
    v_clinic_id, v_actor_id, 'scan_session.pair', p_idempotency_key, p_scan_session_id, v_current.revision + 1
  );

  perform set_config('graftvision.scan_controlled', 'off', true);

  return query select p_scan_session_id, v_current.revision + 1, 'paired'::text;
end;
$$;
revoke all on function graftvision_private.pair_scan_session(uuid, uuid, uuid, text, text) from public, anon, authenticated;

create function graftvision_private.transition_scan_session_status(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid,
  p_new_status text,
  p_reason text,
  p_idempotency_key text
)
returns table (
  scan_session_id uuid,
  revision integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing_idempotency public.scan_operation_idempotency%rowtype;
  v_current public.scan_session%rowtype;
begin
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id
    and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';

  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'CLINICAL-PERM-002') then
    raise exception using errcode = '42501', message = 'INSUFFICIENT_CLINICAL_PERMISSION';
  end if;

  select * into v_existing_idempotency from public.scan_operation_idempotency
  where clinic_id = v_clinic_id
    and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.transition'
    and idempotency_key = p_idempotency_key;

  if found then
    return query select v_existing_idempotency.scan_session_id, v_existing_idempotency.result_revision, p_new_status;
    return;
  end if;

  select * into strict v_current
  from public.scan_session
  where id = p_scan_session_id and clinic_id = v_clinic_id
  for update;

  if p_new_status = 'completed' and v_current.status <> 'paired' then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;

  if p_new_status = 'revoked' and v_current.status not in ('created', 'paired') then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;

  if p_new_status = 'expired' and v_current.status <> 'created' then
    raise exception using errcode = '40001', message = 'INVALID_LIFECYCLE_TRANSITION';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);

-- graftvision:dangerous-sql-approved task=SCAN-001
-- graftvision:dangerous-sql-reason Controlled lifecycle transition update
-- graftvision:corrective-plan Immutability triggers are bypassed only inside this controlled mutation
  update public.scan_session
  set status = p_new_status, revocation_reason = p_reason, updated_at = clock_timestamp(), revision = revision + 1
  where id = p_scan_session_id;

  
  insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
  values (p_scan_session_id, v_clinic_id, p_new_status, v_actor_id);

  
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application
  ) values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'scan_session.transition',
    'scan_session', p_scan_session_id, 'success', p_idempotency_key::uuid, 'database'
  );

  
  insert into public.scan_operation_idempotency(
    clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision
  ) values (
    v_clinic_id, v_actor_id, 'scan_session.transition', p_idempotency_key, p_scan_session_id, v_current.revision + 1
  );

  perform set_config('graftvision.scan_controlled', 'off', true);

  return query select p_scan_session_id, v_current.revision + 1, p_new_status;
end;
$$;
revoke all on function graftvision_private.transition_scan_session_status(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
