-- Migration: SCAN-003 guided capture shell state. No image bytes or object references are stored.

create table public.scan_capture_state (
  scan_session_id uuid primary key references public.scan_session(id) on delete cascade,
  clinic_id uuid not null references public.clinic(id) on delete restrict,
  current_step text not null default 'preparation' check (current_step in (
    'preparation', 'front', 'left_profile', 'right_profile', 'crown', 'donor_rear',
    'donor_left', 'donor_right', 'review', 'capture_complete'
  )),
  completed_steps text[] not null default '{}'::text[] check (completed_steps <@ array[
    'front', 'left_profile', 'right_profile', 'crown', 'donor_rear', 'donor_left', 'donor_right'
  ]::text[]),
  retake_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(retake_counts) = 'object'),
  capture_status text not null default 'preparation' check (capture_status in ('preparation', 'capturing', 'review', 'capture_complete')),
  started_at timestamptz,
  last_activity_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.scan_capture_event (
  id uuid primary key default gen_random_uuid(),
  scan_session_id uuid not null references public.scan_session(id) on delete cascade,
  clinic_id uuid not null references public.clinic(id) on delete restrict,
  event_type text not null check (event_type in ('prepared', 'step_completed', 'step_retaken', 'review_ready', 'capture_completed')),
  step_code text not null check (step_code in (
    'preparation', 'front', 'left_profile', 'right_profile', 'crown', 'donor_rear',
    'donor_left', 'donor_right', 'review', 'capture_complete'
  )),
  actor_platform_user_id uuid references public.platform_user(id) on delete restrict,
  occurred_at timestamptz not null default clock_timestamp()
);

create index scan_capture_state_clinic_idx on public.scan_capture_state (clinic_id, scan_session_id);
create index scan_capture_event_session_idx on public.scan_capture_event (scan_session_id, occurred_at desc);

alter table public.scan_capture_state enable row level security;
alter table public.scan_capture_state force row level security;
alter table public.scan_capture_event enable row level security;
alter table public.scan_capture_event force row level security;
revoke all on table public.scan_capture_state, public.scan_capture_event from public, anon, authenticated;

create trigger scan_capture_state_controlled
before insert or update or delete on public.scan_capture_state
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create trigger scan_capture_event_controlled
before insert or update or delete on public.scan_capture_event
for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create policy scan_capture_state_select on public.scan_capture_state
  for select to authenticated using (
    clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_permission(
      graftvision_private.current_platform_user_id(), graftvision_private.current_clinic_id(), 'CLINICAL-PERM-002'
    )
  );
create policy scan_capture_event_select on public.scan_capture_event
  for select to authenticated using (
    clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_permission(
      graftvision_private.current_platform_user_id(), graftvision_private.current_clinic_id(), 'CLINICAL-PERM-002'
    )
  );

create function graftvision_private.initialise_scan_capture_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'paired' and old.status = 'created' then
    insert into public.scan_capture_state (scan_session_id, clinic_id)
    values (new.id, new.clinic_id);
    insert into public.scan_capture_event (scan_session_id, clinic_id, event_type, step_code, actor_platform_user_id)
    values (new.id, new.clinic_id, 'prepared', 'preparation', new.created_by);
  end if;
  return new;
end;
$$;
revoke all on function graftvision_private.initialise_scan_capture_state() from public, anon, authenticated;
create trigger scan_session_capture_initialise
after update of status on public.scan_session
for each row execute function graftvision_private.initialise_scan_capture_state();

create function graftvision_private.require_scan_capture_context(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid
)
returns table (clinic_id uuid, actor_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_clinic_id uuid; v_actor_id uuid;
begin
  select s.clinic_id, s.platform_user_id into v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id and s.authority_scope = 'clinic';
  if v_clinic_id is null
    or not graftvision_private.has_application_session_permission(p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'CLINICAL-PERM-002')
    or not exists (
      select 1 from public.scan_session ss
      join public.patient p on p.id = ss.patient_id and p.clinic_id = ss.clinic_id
      where ss.id = p_scan_session_id and ss.clinic_id = v_clinic_id and ss.status in ('paired', 'completed')
        and ss.pairing_nonce is not null and ss.expires_at > clock_timestamp() and p.lifecycle_state = 'current'
    )
    or not exists (
      select 1 from public.clinic_membership m
      join public.clinic_membership_role mr on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
      join public.doctor_verification dv on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
      where m.clinic_id = v_clinic_id and m.platform_user_id = v_actor_id and m.membership_status = 'active'
        and dv.status = 'verified' and dv.expires_at > clock_timestamp()
    )
  then raise exception using errcode = '42501', message = 'SCAN_CAPTURE_DENIED'; end if;
  return query select v_clinic_id, v_actor_id;
end;
$$;
revoke all on function graftvision_private.require_scan_capture_context(uuid, uuid, uuid) from public, anon, authenticated;

create function graftvision_private.read_scan_capture_state(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid
)
returns table (
  scan_session_id uuid, status text, revision integer, expires_at timestamptz, current_step text,
  completed_steps text[], retake_counts jsonb, capture_status text, started_at timestamptz,
  last_activity_at timestamptz, completed_at timestamptz, capture_revision integer
)
language plpgsql security definer set search_path = '' as $$
declare v_context record;
begin
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id, p_provider_identity_id, p_scan_session_id);
  return query select ss.id, ss.status, ss.revision, ss.expires_at, cs.current_step, cs.completed_steps,
    cs.retake_counts, cs.capture_status, cs.started_at, cs.last_activity_at, cs.completed_at, cs.revision
  from public.scan_session ss join public.scan_capture_state cs on cs.scan_session_id = ss.id
  where ss.id = p_scan_session_id and ss.clinic_id = v_context.clinic_id;
end;
$$;
revoke all on function graftvision_private.read_scan_capture_state(uuid, uuid, uuid) from public, anon, authenticated;

create function graftvision_private.record_scan_capture_step(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid, p_step text,
  p_action text, p_expected_revision integer, p_idempotency_key text
)
returns table (scan_session_id uuid, status text, revision integer, current_step text, completed_steps text[], retake_counts jsonb, capture_status text, capture_revision integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_current public.scan_capture_state%rowtype; v_session public.scan_session%rowtype;
  v_next_step text; v_event_type text; v_increment integer; v_existing public.scan_operation_idempotency%rowtype;
  v_steps text[] := array['front', 'left_profile', 'right_profile', 'crown', 'donor_rear', 'donor_left', 'donor_right'];
begin
  if p_step not in ('preparation', 'front', 'left_profile', 'right_profile', 'crown', 'donor_rear', 'donor_left', 'donor_right', 'review')
    or p_action not in ('complete', 'retake', 'review') or p_expected_revision < 1
    or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then raise exception using errcode = '22023', message = 'INVALID_SCAN_CAPTURE_INPUT'; end if;
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id, p_provider_identity_id, p_scan_session_id);
  select * into v_existing from public.scan_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = v_context.actor_id
    and request_family = 'scan_capture.update' and idempotency_key = p_idempotency_key;
  if found then
    select * into strict v_session from public.scan_session where id = p_scan_session_id;
    select * into strict v_current from public.scan_capture_state cs where cs.scan_session_id = p_scan_session_id;
    return query select p_scan_session_id, v_session.status, v_session.revision, v_current.current_step,
      v_current.completed_steps, v_current.retake_counts, v_current.capture_status, v_current.revision; return;
  end if;
  select * into strict v_current from public.scan_capture_state cs where cs.scan_session_id = p_scan_session_id and cs.clinic_id = v_context.clinic_id for update;
  select * into strict v_session from public.scan_session where id = p_scan_session_id and clinic_id = v_context.clinic_id for update;
  if v_current.revision <> p_expected_revision or v_session.status <> 'paired' then
    raise exception using errcode = '40001', message = 'SCAN_CAPTURE_CONFLICT';
  end if;
  if p_action = 'retake' then
    if p_step = 'preparation' or not p_step = any(v_current.completed_steps) then raise exception using errcode = '40001', message = 'INVALID_CAPTURE_TRANSITION'; end if;
    v_next_step := p_step; v_event_type := 'step_retaken';
    perform set_config('graftvision.scan_controlled', 'on', true);
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled retry removes only a completed capture slot while preserving immutable capture events.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_capture_state as cs set completed_steps = array_remove(cs.completed_steps, p_step),
      retake_counts = jsonb_set(cs.retake_counts, array[p_step], to_jsonb(coalesce((cs.retake_counts ->> p_step)::integer, 0) + 1), true),
      current_step = v_next_step, capture_status = 'capturing', last_activity_at = clock_timestamp(), updated_at = clock_timestamp(), revision = cs.revision + 1
    where cs.scan_session_id = p_scan_session_id;
  elsif p_action = 'review' then
    if p_step <> 'review' or cardinality(v_current.completed_steps) <> cardinality(v_steps) then raise exception using errcode = '40001', message = 'INVALID_CAPTURE_TRANSITION'; end if;
    v_next_step := 'review'; v_event_type := 'review_ready';
    perform set_config('graftvision.scan_controlled', 'on', true);
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled capture-review progression with all required slots complete.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_capture_state as cs set current_step = v_next_step, capture_status = 'review',
      last_activity_at = clock_timestamp(), updated_at = clock_timestamp(), revision = cs.revision + 1 where cs.scan_session_id = p_scan_session_id;
  elsif p_step = 'preparation' then
    if v_current.current_step <> 'preparation' then raise exception using errcode = '40001', message = 'INVALID_CAPTURE_TRANSITION'; end if;
    v_next_step := 'front'; v_event_type := 'step_completed';
    perform set_config('graftvision.scan_controlled', 'on', true);
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled preparation completion begins the deterministic capture checklist.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_capture_state as cs set current_step = v_next_step, capture_status = 'capturing', started_at = coalesce(cs.started_at, clock_timestamp()),
      last_activity_at = clock_timestamp(), updated_at = clock_timestamp(), revision = cs.revision + 1 where cs.scan_session_id = p_scan_session_id;
  elsif p_step = 'review' then
    if v_current.current_step <> 'review' or cardinality(v_current.completed_steps) <> cardinality(v_steps) then raise exception using errcode = '40001', message = 'INVALID_CAPTURE_TRANSITION'; end if;
    v_next_step := 'capture_complete'; v_event_type := 'capture_completed';
    perform set_config('graftvision.scan_controlled', 'on', true);
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled finalisation records a completed checklist before scan-session completion.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_capture_state as cs set current_step = v_next_step, capture_status = 'capture_complete', completed_at = clock_timestamp(),
      last_activity_at = clock_timestamp(), updated_at = clock_timestamp(), revision = cs.revision + 1 where cs.scan_session_id = p_scan_session_id;
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled scan lifecycle completion follows a fully completed capture checklist.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_session as ss set status = 'completed', updated_at = clock_timestamp(), revision = ss.revision + 1 where ss.id = p_scan_session_id;
    insert into public.audit_event (audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type, resource_id, outcome, request_id, source_application, metadata)
    values ('clinic', v_context.clinic_id, v_context.actor_id, 'user', 'scan_session.complete', 'scan_session', p_scan_session_id, 'success', p_idempotency_key::uuid, 'database', jsonb_build_object('new_status', 'completed'));
  else
    if v_current.current_step <> p_step or p_step = any(v_current.completed_steps) then raise exception using errcode = '40001', message = 'INVALID_CAPTURE_TRANSITION'; end if;
    v_increment := array_position(v_steps, p_step);
    v_next_step := case when v_increment = cardinality(v_steps) then 'review' else v_steps[v_increment + 1] end;
    v_event_type := 'step_completed';
    perform set_config('graftvision.scan_controlled', 'on', true);
-- graftvision:dangerous-sql-approved task=SCAN-003
-- graftvision:dangerous-sql-reason Controlled deterministic capture-slot completion retains no image or clinical payload.
-- graftvision:corrective-plan Forward-fix through a later additive migration; event history remains immutable.
    update public.scan_capture_state as cs set completed_steps = array_append(cs.completed_steps, p_step), current_step = v_next_step,
      capture_status = case when v_next_step = 'review' then 'review' else 'capturing' end, last_activity_at = clock_timestamp(),
      updated_at = clock_timestamp(), revision = cs.revision + 1 where cs.scan_session_id = p_scan_session_id;
  end if;
  insert into public.scan_capture_event (scan_session_id, clinic_id, event_type, step_code, actor_platform_user_id)
  values (p_scan_session_id, v_context.clinic_id, v_event_type, coalesce(v_next_step, p_step), v_context.actor_id);
  select * into strict v_current from public.scan_capture_state cs where cs.scan_session_id = p_scan_session_id;
  select * into strict v_session from public.scan_session where id = p_scan_session_id;
  insert into public.scan_operation_idempotency (clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision)
  values (v_context.clinic_id, v_context.actor_id, 'scan_capture.update', p_idempotency_key, p_scan_session_id, v_current.revision);
  perform set_config('graftvision.scan_controlled', 'off', true);
  return query select p_scan_session_id, v_session.status, v_session.revision, v_current.current_step,
    v_current.completed_steps, v_current.retake_counts, v_current.capture_status, v_current.revision;
end;
$$;
revoke all on function graftvision_private.record_scan_capture_step(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
