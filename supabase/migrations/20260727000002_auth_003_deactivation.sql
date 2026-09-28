-- GraftVision migration
-- Task: AUTH-003
-- Purpose: Add authorization_version snapshots to sessions, and controlled deactivation functions.
-- Created UTC: 20260727000002
-- Category: schema modification, constraints, functions, triggers
-- graftvision:dangerous-sql-approved task=AUTH-003
-- graftvision:dangerous-sql-reason Reviewed authorization-version backfill updates.
-- graftvision:corrective-plan Restore from the pre-migration snapshot if the controlled backfill fails.

-- 1. Add nullable authorization version columns
alter table public.application_session
  add column platform_authorization_version integer,
  add column clinic_authorization_version integer;

-- 1.1 Grant read access to authenticated so RLS can function
grant select on public.application_session to authenticated, anon;

-- 2. Backfill existing sessions securely
update public.application_session s
set platform_authorization_version = p.authorization_version
from public.platform_user p
where s.platform_user_id = p.id;

update public.application_session s
set clinic_authorization_version = m.authorization_version
from public.clinic_membership m
where s.clinic_id = m.clinic_id 
  and s.platform_user_id = m.platform_user_id;

-- 3. Set platform_authorization_version NOT NULL
alter table public.application_session
  alter column platform_authorization_version set not null;

-- 4. Constrain clinic_authorization_version to accompany clinic_id
alter table public.application_session
  add constraint application_session_clinic_auth_version_check
  check (
    (clinic_id is null and clinic_authorization_version is null) or
    (clinic_id is not null and clinic_authorization_version is not null)
  );

-- 5. Atomic session creation function that snapshots versions internally
create or replace function graftvision_private.create_application_session(
  p_platform_user_id uuid,
  p_clinic_id uuid,
  p_provider_session_id text,
  p_absolute_expires_at timestamptz,
  p_device_label text,
  p_user_agent_hash text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_platform_version integer;
  v_clinic_version integer;
begin
  -- Snapshot platform authorization version
  select authorization_version into v_platform_version
  from public.platform_user
  where id = p_platform_user_id and status = 'active';

  if v_platform_version is null then
    raise exception using errcode = '28000', message = 'INVALID_OR_INACTIVE_PLATFORM_USER';
  end if;

  -- Snapshot clinic authorization version if clinic_id provided
  if p_clinic_id is not null then
    select authorization_version into v_clinic_version
    from public.clinic_membership
    where platform_user_id = p_platform_user_id 
      and clinic_id = p_clinic_id
      and membership_status = 'active';
      
    if v_clinic_version is null then
      raise exception using errcode = '28000', message = 'INVALID_OR_INACTIVE_CLINIC_MEMBERSHIP';
    end if;
  end if;

  insert into public.application_session (
    platform_user_id,
    clinic_id,
    provider_session_id,
    platform_authorization_version,
    clinic_authorization_version,
    absolute_expires_at,
    device_label,
    user_agent_hash
  )
  values (
    p_platform_user_id,
    p_clinic_id,
    p_provider_session_id,
    v_platform_version,
    v_clinic_version,
    p_absolute_expires_at,
    p_device_label,
    p_user_agent_hash
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function graftvision_private.create_application_session(uuid, uuid, text, timestamptz, text, text) from public;

-- 6. Central authoritative session validation and revocation
create or replace function graftvision_private.validate_application_session(p_session_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_session record;
  v_platform_status text;
  v_platform_version integer;
  v_clinic_status text;
  v_membership_status text;
  v_clinic_version integer;
begin
  -- Lock the session row for update to prevent race conditions during revocation
  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if not found or v_session.revoked_at is not null or v_session.expires_at < clock_timestamp() then
    return false;
  end if;

  -- Verify Platform User
  select status, authorization_version into v_platform_status, v_platform_version
  from public.platform_user
  where id = v_session.platform_user_id;

  if v_platform_status != 'active' then
    update public.application_session 
    set revoked_at = clock_timestamp(), revocation_reason = 'platform_user_deactivated'
    where id = p_session_id;
    
    insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id, payload)
    values ('session.revoke_inactive_user', null, null, 'application_session', p_session_id, jsonb_build_object('reason', 'platform_user_deactivated'));
    
    return false;
  end if;

  if v_session.platform_authorization_version != v_platform_version then
    update public.application_session 
    set revoked_at = clock_timestamp(), revocation_reason = 'platform_authorization_changed'
    where id = p_session_id;
    
    insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id, payload)
    values ('session.revoke_authorization_change', null, null, 'application_session', p_session_id, jsonb_build_object('reason', 'platform_authorization_changed'));
    
    return false;
  end if;

  -- Verify Clinic and Membership if scoped
  if v_session.clinic_id is not null then
    select c.status into v_clinic_status
    from public.clinic c
    where c.id = v_session.clinic_id;

    select m.membership_status, m.authorization_version into v_membership_status, v_clinic_version
    from public.clinic_membership m
    where m.clinic_id = v_session.clinic_id and m.platform_user_id = v_session.platform_user_id;

    if coalesce(v_clinic_status, '') != 'active' or coalesce(v_membership_status, '') != 'active' then
      update public.application_session 
      set revoked_at = clock_timestamp(), revocation_reason = 'clinic_membership_suspended'
      where id = p_session_id;
      
      insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id, payload)
      values ('session.revoke_inactive_membership', null, v_session.clinic_id, 'application_session', p_session_id, jsonb_build_object('reason', 'clinic_membership_suspended'));
      
      return false;
    end if;

    if v_session.clinic_authorization_version != v_clinic_version then
      update public.application_session 
      set revoked_at = clock_timestamp(), revocation_reason = 'clinic_authorization_changed'
      where id = p_session_id;
      
      insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id, payload)
      values ('session.revoke_authorization_change', null, v_session.clinic_id, 'application_session', p_session_id, jsonb_build_object('reason', 'clinic_authorization_changed'));
      
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function graftvision_private.validate_application_session(uuid) from public;

-- 7. Controlled Deactivation/Reactivation functions
create or replace function public.deactivate_platform_user(p_target_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;
  
  if not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.platform_user 
  set status = 'suspended',
      authorization_version = authorization_version + 1,
      updated_at = clock_timestamp()
  where id = p_target_id;

  insert into public.audit_event (action, actor_platform_user_id, target_resource_type, target_resource_id)
  values ('user.deactivate', v_actor_id, 'platform_user', p_target_id);
end;
$$;

create or replace function public.reactivate_platform_user(p_target_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;
  
  if not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.platform_user 
  set status = 'active',
      authorization_version = authorization_version + 1,
      updated_at = clock_timestamp()
  where id = p_target_id;

  insert into public.audit_event (action, actor_platform_user_id, target_resource_type, target_resource_id)
  values ('user.reactivate', v_actor_id, 'platform_user', p_target_id);
end;
$$;

create or replace function public.deactivate_clinic_membership(p_membership_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clinic_id uuid;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select clinic_id into v_clinic_id from public.clinic_membership where id = p_membership_id;
  if v_clinic_id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  
  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'ADMIN-PERM-003') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.clinic_membership 
  set membership_status = 'suspended',
      authorization_version = authorization_version + 1,
      updated_at = clock_timestamp()
  where id = p_membership_id;

  insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id)
  values ('membership.suspend', v_actor_id, v_clinic_id, 'clinic_membership', p_membership_id);
end;
$$;

create or replace function public.reactivate_clinic_membership(p_membership_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clinic_id uuid;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select clinic_id into v_clinic_id from public.clinic_membership where id = p_membership_id;
  if v_clinic_id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  
  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'ADMIN-PERM-003') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.clinic_membership 
  set membership_status = 'active',
      authorization_version = authorization_version + 1,
      updated_at = clock_timestamp()
  where id = p_membership_id;

  insert into public.audit_event (action, actor_platform_user_id, tenant_id, target_resource_type, target_resource_id)
  values ('membership.reactivate', v_actor_id, v_clinic_id, 'clinic_membership', p_membership_id);
end;
$$;
