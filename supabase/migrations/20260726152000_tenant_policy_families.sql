-- GraftVision migration
-- Task: TENANT-002
-- Purpose: Add reusable trusted tenant-context, active-tenant predicate, and immutable ownership helpers.
-- Created UTC: 20260726152000
-- Category: functions, privilege hardening, and reusable tenant policy foundations
-- Compatibility: Additive only; existing tables, policies, data, and historical migrations are unchanged.
-- Transaction and locks: Function creation only; no table rewrite or product-schema lock is introduced.
-- Tenant and RLS impact: Adds owner-only context setup and a deny-safe predicate for future RLS policies.
-- Data impact: No data or persistent fixture table is created.
-- Verification: Static policy checks, package tests, and transaction-scoped pgTAP fixture tables.
-- Corrective plan: Forward-fix with a later reviewed migration; no destructive rollback is included.
--
-- Future tenant-owned table convention:
-- - physically store clinic_id;
-- - add unique (clinic_id, id) on every referenced parent;
-- - use foreign key (clinic_id, parent_id) references parent (clinic_id, id);
-- - scope local uniqueness with clinic_id;
-- - attach prevent_clinic_id_change before update of clinic_id;
-- - enable and force RLS, then compose tenant_row_is_accessible with later permission/state checks.

create function graftvision_private.set_tenant_context(
  context_platform_user_id uuid,
  context_clinic_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_platform_user_id uuid := graftvision_private.current_platform_user_id();
  existing_clinic_id uuid := graftvision_private.current_clinic_id();
  active_membership_exists boolean;
begin
  if context_platform_user_id is null or context_clinic_id is null then
    raise exception using
      errcode = '22023',
      message = 'trusted tenant context requires actor and clinic';
  end if;

  if existing_platform_user_id is not null or existing_clinic_id is not null then
    if existing_platform_user_id = context_platform_user_id
      and existing_clinic_id = context_clinic_id then
      return;
    end if;

    raise exception using
      errcode = '25001',
      message = 'trusted tenant context cannot change within a transaction';
  end if;

  select exists (
    select 1
    from public.clinic_membership membership
    join public.platform_user platform_user
      on platform_user.id = membership.platform_user_id
    join public.clinic clinic
      on clinic.id = membership.clinic_id
    where membership.platform_user_id = context_platform_user_id
      and membership.clinic_id = context_clinic_id
      and membership.membership_status = 'active'
      and platform_user.status = 'active'
      and clinic.status = 'active'
  )
  into active_membership_exists;

  if not active_membership_exists then
    raise exception using
      errcode = '42501',
      message = 'active tenant membership is required';
  end if;

  perform set_config(
    'graftvision.platform_user_id',
    context_platform_user_id::text,
    true
  );
  perform set_config(
    'graftvision.clinic_id',
    context_clinic_id::text,
    true
  );
end;
$$;

comment on function graftvision_private.set_tenant_context(uuid, uuid) is
  'Owner-only transaction-local context setup. Same-context reuse is idempotent; actor or clinic switching is rejected.';

create function graftvision_private.require_active_clinic_membership()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  trusted_platform_user_id uuid := graftvision_private.current_platform_user_id();
  trusted_clinic_id uuid := graftvision_private.current_clinic_id();
begin
  if trusted_platform_user_id is null or trusted_clinic_id is null then
    raise exception using
      errcode = '42501',
      message = 'trusted tenant context is required';
  end if;

  if not graftvision_private.has_active_clinic_membership(trusted_clinic_id) then
    raise exception using
      errcode = '42501',
      message = 'active tenant membership is required';
  end if;
end;
$$;

create function graftvision_private.tenant_row_is_accessible(candidate_clinic_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select candidate_clinic_id is not null
    and candidate_clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_active_clinic_membership(candidate_clinic_id);
$$;

comment on function graftvision_private.tenant_row_is_accessible(uuid) is
  'Foundational active-tenant RLS predicate. Future permission, role, state, and approval predicates remain mandatory additions.';

create function graftvision_private.prevent_clinic_id_change()
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

comment on function graftvision_private.prevent_clinic_id_change() is
  'Reusable trigger for future clinic-owned tables. It permits no-op updates and rejects ownership transfer.';

alter function graftvision_private.set_tenant_context(uuid, uuid) owner to postgres;
alter function graftvision_private.require_active_clinic_membership() owner to postgres;
alter function graftvision_private.tenant_row_is_accessible(uuid) owner to postgres;
alter function graftvision_private.prevent_clinic_id_change() owner to postgres;

revoke all on function graftvision_private.set_tenant_context(uuid, uuid)
  from public, anon, authenticated;
revoke all on function graftvision_private.require_active_clinic_membership()
  from public, anon, authenticated;
revoke all on function graftvision_private.tenant_row_is_accessible(uuid)
  from public, anon, authenticated;
revoke all on function graftvision_private.prevent_clinic_id_change()
  from public, anon, authenticated;

grant execute on function graftvision_private.tenant_row_is_accessible(uuid)
  to authenticated;
