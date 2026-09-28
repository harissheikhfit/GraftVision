-- GraftVision migration
-- Task: SESSION-001
-- Purpose: Create the application_session table for secure session lifecycle and extend audit taxonomy.
-- Created UTC: 20260726193242

create table public.application_session (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references public.platform_user(id) on delete cascade,
  clinic_id uuid references public.clinic(id) on delete set null,
  provider_session_id uuid,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  last_activity_at timestamptz not null default timezone('utc', statement_timestamp()),
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason_code text
    check (revoke_reason_code in ('LOGOUT', 'REVOKE_ONE', 'REVOKE_ALL', 'DEACTIVATED')),
  device_label text not null,
  user_agent_hash text,
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  check (
    (revoked_at is null and revoke_reason_code is null) or
    (revoked_at is not null and revoke_reason_code is not null)
  )
);

comment on table public.application_session is
  'Authoritative GraftVision application session registry. Bypasses direct browser access via deny-by-default RLS.';

create index application_session_platform_user_id_idx on public.application_session (platform_user_id);
create index application_session_provider_session_id_idx on public.application_session (provider_session_id);

alter table public.application_session enable row level security;

create policy "Deny all application_session selects" on public.application_session for select to authenticated using (false);
create policy "Deny all application_session inserts" on public.application_session for insert to authenticated with check (false);
create policy "Deny all application_session updates" on public.application_session for update to authenticated using (false);
create policy "Deny all application_session deletes" on public.application_session for delete to authenticated using (false);

create or replace function graftvision_private.is_valid_audit_action(candidate text)
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
    'session.create',
    'session.end',
    'session.revoke_other',
    'session.revoke_others',
    'session.expire_idle',
    'session.expire_absolute',
    'session.deny_inactive_user',
    'storage_key.validate',
    'system.migration'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit_event',
    'application_session',
    'clinic',
    'clinic_membership',
    'platform_user',
    'storage_object_key',
    'system'
  );
$$;
