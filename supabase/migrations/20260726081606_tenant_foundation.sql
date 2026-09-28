-- GraftVision migration
-- Task: TENANT-001
-- Purpose: Create the minimal clinic tenant, platform identity, membership, and deny-by-default RLS foundation.
-- Created UTC: 20260726081606
-- Category: schema creation, constraints, indexes, functions, triggers, grants, and RLS policies
-- Compatibility: Additive foundation only; no existing table, column, or policy is changed.
-- Transaction and locks: New objects only; Supabase applies this migration transactionally during reset.
-- Tenant and RLS impact: Establishes clinic as tenant root and denies access without trusted user/clinic context.
-- Data impact: No production or fixture data is inserted.
-- Verification: Static tenant-policy checks and transactional pgTAP isolation tests.
-- Corrective plan: Forward-fix with a later reviewed migration; no destructive rollback is included.
--
-- Security intent:
-- - UUID identifiers avoid client-visible sequence assumptions.
-- - Context is transaction-local and may be established only by the trusted local test/admin role.
-- - Authenticated access requires an active membership matching both trusted user and clinic context.
-- - Ordinary callers receive read-only tenant visibility; every write is explicitly denied.

create schema if not exists graftvision_private;

revoke all on schema graftvision_private from public;
grant usage on schema graftvision_private to authenticated;

create table public.platform_user (
  id uuid primary key default gen_random_uuid(),
  external_identity_id text unique,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  check (external_identity_id is null or length(btrim(external_identity_id)) between 1 and 255)
);

comment on table public.platform_user is
  'Provider-neutral internal identity mapping for TENANT-001; contains no credentials or authentication state.';

create table public.clinic (
  id uuid primary key default gen_random_uuid(),
  clinic_code text not null,
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  archived_at timestamptz,
  check (clinic_code ~ '^[a-z][a-z0-9-]{2,62}$'),
  check (length(btrim(display_name)) between 1 and 160),
  check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  )
);

comment on table public.clinic is
  'Root tenant record. Creation, status changes, archive, and deletion remain trusted administrative operations.';

create unique index clinic_code_case_insensitive_unique
  on public.clinic (lower(clinic_code));

create table public.clinic_membership (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  platform_user_id uuid not null,
  membership_status text not null default 'active'
    check (membership_status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint clinic_membership_clinic_fk
    foreign key (clinic_id) references public.clinic (id)
    on update restrict on delete restrict,
  constraint clinic_membership_platform_user_fk
    foreign key (platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict,
  constraint clinic_membership_clinic_user_unique
    unique (clinic_id, platform_user_id)
);

comment on table public.clinic_membership is
  'Connects one platform user to exactly one clinic per membership; role assignments are deliberately deferred.';

create index clinic_membership_user_status_clinic_idx
  on public.clinic_membership (platform_user_id, membership_status, clinic_id);

create function graftvision_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', statement_timestamp());
  return new;
end;
$$;

revoke all on function graftvision_private.set_updated_at() from public;

create trigger platform_user_set_updated_at
before update on public.platform_user
for each row execute function graftvision_private.set_updated_at();

create trigger clinic_set_updated_at
before update on public.clinic
for each row execute function graftvision_private.set_updated_at();

create trigger clinic_membership_set_updated_at
before update on public.clinic_membership
for each row execute function graftvision_private.set_updated_at();

create function graftvision_private.prevent_membership_clinic_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception using
      errcode = '23514',
      message = 'clinic ownership is immutable';
  end if;

  return new;
end;
$$;

revoke all on function graftvision_private.prevent_membership_clinic_change() from public;

create trigger clinic_membership_prevent_clinic_change
before update of clinic_id on public.clinic_membership
for each row execute function graftvision_private.prevent_membership_clinic_change();

create function graftvision_private.current_platform_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context_value text;
begin
  context_value := nullif(current_setting('graftvision.platform_user_id', true), '');

  if context_value is null then
    return null;
  end if;

  begin
    return context_value::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create function graftvision_private.current_clinic_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context_value text;
begin
  context_value := nullif(current_setting('graftvision.clinic_id', true), '');

  if context_value is null then
    return null;
  end if;

  begin
    return context_value::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create function graftvision_private.has_active_clinic_membership(candidate_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_membership membership
    join public.platform_user platform_user
      on platform_user.id = membership.platform_user_id
    join public.clinic clinic
      on clinic.id = membership.clinic_id
    where membership.clinic_id = candidate_clinic_id
      and membership.clinic_id = graftvision_private.current_clinic_id()
      and membership.platform_user_id = graftvision_private.current_platform_user_id()
      and membership.membership_status = 'active'
      and platform_user.status = 'active'
      and clinic.status = 'active'
  );
$$;

create function graftvision_private.set_test_tenant_context(
  context_platform_user_id uuid,
  context_clinic_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config(
    'graftvision.platform_user_id',
    coalesce(context_platform_user_id::text, ''),
    true
  );
  perform set_config(
    'graftvision.clinic_id',
    coalesce(context_clinic_id::text, ''),
    true
  );
end;
$$;

comment on function graftvision_private.set_test_tenant_context(uuid, uuid) is
  'TENANT-001 local test/admin helper. Transaction-local only; never callable by anon or authenticated.';

create function graftvision_private.clear_test_tenant_context()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('graftvision.platform_user_id', '', true);
  perform set_config('graftvision.clinic_id', '', true);
end;
$$;

revoke all on function graftvision_private.current_platform_user_id() from public;
revoke all on function graftvision_private.current_clinic_id() from public;
revoke all on function graftvision_private.has_active_clinic_membership(uuid) from public;
revoke all on function graftvision_private.set_test_tenant_context(uuid, uuid) from public;
revoke all on function graftvision_private.clear_test_tenant_context() from public;

grant execute on function graftvision_private.current_platform_user_id() to authenticated;
grant execute on function graftvision_private.current_clinic_id() to authenticated;
grant execute on function graftvision_private.has_active_clinic_membership(uuid) to authenticated;

alter table public.platform_user enable row level security;
alter table public.platform_user force row level security;
alter table public.clinic enable row level security;
alter table public.clinic force row level security;
alter table public.clinic_membership enable row level security;
alter table public.clinic_membership force row level security;

revoke all on table public.platform_user from anon, authenticated;
revoke all on table public.clinic from anon, authenticated;
revoke all on table public.clinic_membership from anon, authenticated;

grant select, insert, update, delete on table public.platform_user to authenticated;
grant select, insert, update, delete on table public.clinic to authenticated;
grant select, insert, update, delete on table public.clinic_membership to authenticated;

create policy platform_user_select_own
on public.platform_user
for select
to authenticated
using (
  id = graftvision_private.current_platform_user_id()
);

create policy platform_user_deny_insert
on public.platform_user
for insert
to authenticated
with check (false);

create policy platform_user_deny_update
on public.platform_user
for update
to authenticated
using (false)
with check (false);

create policy platform_user_deny_delete
on public.platform_user
for delete
to authenticated
using (false);

create policy clinic_select_active_membership
on public.clinic
for select
to authenticated
using (
  id = graftvision_private.current_clinic_id()
  and graftvision_private.has_active_clinic_membership(id)
);

create policy clinic_deny_insert
on public.clinic
for insert
to authenticated
with check (false);

create policy clinic_deny_update
on public.clinic
for update
to authenticated
using (false)
with check (false);

create policy clinic_deny_delete
on public.clinic
for delete
to authenticated
using (false);

create policy clinic_membership_select_own_active
on public.clinic_membership
for select
to authenticated
using (
  platform_user_id = graftvision_private.current_platform_user_id()
  and clinic_id = graftvision_private.current_clinic_id()
  and membership_status = 'active'
  and graftvision_private.has_active_clinic_membership(clinic_id)
);

create policy clinic_membership_deny_insert
on public.clinic_membership
for insert
to authenticated
with check (false);

create policy clinic_membership_deny_update
on public.clinic_membership
for update
to authenticated
using (false)
with check (false);

create policy clinic_membership_deny_delete
on public.clinic_membership
for delete
to authenticated
using (false);
