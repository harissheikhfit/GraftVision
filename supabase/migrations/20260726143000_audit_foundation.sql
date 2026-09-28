-- GraftVision migration
-- Task: AUDIT-001
-- Purpose: Create the minimum append-only audit event and trusted write foundation.
-- Created UTC: 20260726143000
-- Category: schema creation, constraints, indexes, functions, trigger, privileges, and RLS
-- Compatibility: Additive only; the existing tenant tables, functions, grants, and policies are unchanged.
-- Transaction and locks: New objects only; Supabase applies this migration transactionally during reset.
-- Tenant and RLS impact: Adds deny-all ordinary access and derives clinic/user scope from trusted context.
-- Data impact: No production or fixture data is inserted.
-- Verification: Static audit-policy checks plus transactional pgTAP audit and tenant-isolation tests.
-- Corrective plan: Forward-fix with a later reviewed migration; no destructive rollback is included.
--
-- Security intent:
-- - Audit IDs are opaque database-generated UUIDs and timestamps are database generated.
-- - Clinic and actor authority are never accepted as function arguments.
-- - Normal roles have no table privileges, RLS policies, or function execution rights.
-- - Metadata is a small, flat allowlist and cannot contain arbitrary request or clinical content.
-- - Update and delete fail through a table trigger even for a privileged accidental query.

create function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct',
    'audit.create',
    'clinic.read',
    'membership.create',
    'membership.read',
    'storage_key.validate',
    'system.migration'
  );
$$;

create function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit_event',
    'clinic',
    'clinic_membership',
    'platform_user',
    'storage_object_key',
    'system'
  );
$$;

create function graftvision_private.is_valid_audit_outcome(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in ('denied', 'failure', 'success');
$$;

create function graftvision_private.is_valid_audit_source_application(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in ('database', 'present', 'scan', 'system', 'web');
$$;

create function graftvision_private.is_valid_audit_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_key text;
  metadata_value jsonb;
begin
  if candidate is null
    or jsonb_typeof(candidate) <> 'object'
    or octet_length(convert_to(candidate::text, 'UTF8')) > 2048 then
    return false;
  end if;

  for metadata_key, metadata_value in
    select key, value from jsonb_each(candidate)
  loop
    case metadata_key
      when 'affected_count' then
        if jsonb_typeof(metadata_value) <> 'number'
          or metadata_value::text !~ '^[0-9]{1,7}$'
          or metadata_value::text::bigint > 1000000 then
          return false;
        end if;
      when 'changed_fields' then
        if jsonb_typeof(metadata_value) <> 'array'
          or jsonb_array_length(metadata_value) > 32
          or exists (
            select 1
            from jsonb_array_elements(metadata_value) as item(value)
            where jsonb_typeof(item.value) <> 'string'
              or item.value #>> '{}' !~ '^[a-z][a-z0-9_]{0,62}$'
          ) then
          return false;
        end if;
      when 'error_code',
           'new_status',
           'policy_decision_code',
           'previous_status',
           'route_family',
           'storage_object_class' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function graftvision_private.is_valid_audit_action(text)
  from public, anon, authenticated;
revoke all on function graftvision_private.is_valid_audit_resource_type(text)
  from public, anon, authenticated;
revoke all on function graftvision_private.is_valid_audit_outcome(text)
  from public, anon, authenticated;
revoke all on function graftvision_private.is_valid_audit_source_application(text)
  from public, anon, authenticated;
revoke all on function graftvision_private.is_valid_audit_metadata(jsonb)
  from public, anon, authenticated;

create table public.audit_event (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default timezone('utc', statement_timestamp()),
  audit_scope text not null
    check (audit_scope in ('clinic', 'platform')),
  clinic_id uuid,
  actor_platform_user_id uuid,
  actor_type text not null
    check (actor_type in ('system', 'user')),
  actor_role_snapshot text,
  action text not null
    check (graftvision_private.is_valid_audit_action(action)),
  resource_type text not null
    check (graftvision_private.is_valid_audit_resource_type(resource_type)),
  resource_id uuid,
  outcome text not null
    check (graftvision_private.is_valid_audit_outcome(outcome)),
  reason_code text,
  request_id uuid,
  source_application text not null
    check (graftvision_private.is_valid_audit_source_application(source_application)),
  metadata jsonb not null default '{}'::jsonb
    check (graftvision_private.is_valid_audit_metadata(metadata)),
  constraint audit_event_scope_clinic_check check (
    (audit_scope = 'clinic' and clinic_id is not null)
    or (audit_scope = 'platform' and clinic_id is null)
  ),
  constraint audit_event_actor_check check (
    (actor_type = 'user' and actor_platform_user_id is not null)
    or (actor_type = 'system' and actor_platform_user_id is null)
  ),
  constraint audit_event_role_snapshot_deferred_check check (
    actor_role_snapshot is null
  ),
  constraint audit_event_reason_code_check check (
    reason_code is null
    or reason_code ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$'
  ),
  constraint audit_event_clinic_fk
    foreign key (clinic_id) references public.clinic (id)
    on update restrict on delete restrict,
  constraint audit_event_actor_platform_user_fk
    foreign key (actor_platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict
);

comment on table public.audit_event is
  'Append-only, content-minimised security evidence. Normal roles have no direct read or mutation access.';

comment on column public.audit_event.actor_role_snapshot is
  'Reserved as null until the approved role foundation can supply a trusted effective-role snapshot.';

comment on column public.audit_event.metadata is
  'Maximum 2048 UTF-8 bytes; flat allowlisted keys only; never clinical content, credentials, request bodies, or raw errors.';

create index audit_event_clinic_occurred_at_idx
  on public.audit_event (clinic_id, occurred_at desc)
  where clinic_id is not null;

create index audit_event_actor_occurred_at_idx
  on public.audit_event (actor_platform_user_id, occurred_at desc)
  where actor_platform_user_id is not null;

create index audit_event_resource_occurred_at_idx
  on public.audit_event (resource_type, resource_id, occurred_at desc)
  where resource_id is not null;

create function graftvision_private.prevent_audit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'audit events are immutable';
end;
$$;

revoke all on function graftvision_private.prevent_audit_event_mutation()
  from public, anon, authenticated;

create trigger audit_event_prevent_mutation
before update or delete on public.audit_event
for each row execute function graftvision_private.prevent_audit_event_mutation();

create function graftvision_private.write_clinic_audit_event(
  event_action text,
  event_resource_type text,
  event_resource_id uuid,
  event_outcome text,
  event_reason_code text,
  event_request_id uuid,
  event_source_application text,
  event_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trusted_actor_id uuid := graftvision_private.current_platform_user_id();
  trusted_clinic_id uuid := graftvision_private.current_clinic_id();
  created_event_id uuid;
begin
  if trusted_clinic_id is null then
    raise exception using errcode = '42501', message = 'audit tenant context is required';
  end if;

  if trusted_actor_id is null then
    raise exception using errcode = '42501', message = 'audit actor context is required';
  end if;

  if not graftvision_private.has_active_clinic_membership(trusted_clinic_id) then
    raise exception using errcode = '42501', message = 'audit tenant context is not authorised';
  end if;

  if not graftvision_private.is_valid_audit_action(event_action)
    or not graftvision_private.is_valid_audit_resource_type(event_resource_type)
    or not graftvision_private.is_valid_audit_outcome(event_outcome)
    or not graftvision_private.is_valid_audit_source_application(event_source_application)
    or not graftvision_private.is_valid_audit_metadata(event_metadata)
    or (
      event_reason_code is not null
      and event_reason_code !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$'
    ) then
    raise exception using errcode = '22023', message = 'audit event input is invalid';
  end if;

  insert into public.audit_event (
    audit_scope,
    clinic_id,
    actor_platform_user_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    outcome,
    reason_code,
    request_id,
    source_application,
    metadata
  )
  values (
    'clinic',
    trusted_clinic_id,
    trusted_actor_id,
    'user',
    event_action,
    event_resource_type,
    event_resource_id,
    event_outcome,
    event_reason_code,
    event_request_id,
    event_source_application,
    event_metadata
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

comment on function graftvision_private.write_clinic_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) is
  'Owner-only AUDIT-001 write path. Derives clinic and actor from trusted transaction context and requires active membership.';

create function graftvision_private.write_platform_system_audit_event(
  event_action text,
  event_resource_type text,
  event_resource_id uuid,
  event_outcome text,
  event_reason_code text,
  event_request_id uuid,
  event_source_application text,
  event_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_event_id uuid;
begin
  if not graftvision_private.is_valid_audit_action(event_action)
    or not graftvision_private.is_valid_audit_resource_type(event_resource_type)
    or not graftvision_private.is_valid_audit_outcome(event_outcome)
    or not graftvision_private.is_valid_audit_source_application(event_source_application)
    or event_source_application not in ('database', 'system')
    or not graftvision_private.is_valid_audit_metadata(event_metadata)
    or (
      event_reason_code is not null
      and event_reason_code !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$'
    ) then
    raise exception using errcode = '22023', message = 'audit event input is invalid';
  end if;

  insert into public.audit_event (
    audit_scope,
    actor_type,
    action,
    resource_type,
    resource_id,
    outcome,
    reason_code,
    request_id,
    source_application,
    metadata
  )
  values (
    'platform',
    'system',
    event_action,
    event_resource_type,
    event_resource_id,
    event_outcome,
    event_reason_code,
    event_request_id,
    event_source_application,
    event_metadata
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

comment on function graftvision_private.write_platform_system_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) is
  'Owner-only AUDIT-001 platform-system path. Platform-user authority remains deferred to RBAC.';

alter function graftvision_private.write_clinic_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) owner to postgres;
alter function graftvision_private.write_platform_system_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) owner to postgres;

revoke all on function graftvision_private.write_clinic_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function graftvision_private.write_platform_system_audit_event(
  text, text, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated;

alter table public.audit_event enable row level security;
alter table public.audit_event force row level security;

revoke all on table public.audit_event from public, anon, authenticated;

-- Intentionally no audit_event RLS policies. AUDIT-001 selects Option A: no normal read access,
-- and direct inserts/updates/deletes are also denied. AUDIT-002 will add reviewed role projections.
