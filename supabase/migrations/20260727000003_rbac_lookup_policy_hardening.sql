-- GraftVision migration
-- Task: RBAC-001
-- Purpose: Restrict RBAC lookup visibility to linked platform users.
-- Created UTC: 20260727000003
-- graftvision:dangerous-sql-approved task=RBAC-001
-- graftvision:dangerous-sql-reason Reviewed corrective session, role, and authorization updates.
-- graftvision:corrective-plan Restore from the pre-migration snapshot if corrective updates fail.

drop policy lookup_select on public.role_definition;
create policy lookup_select
on public.role_definition
for select
to authenticated
using (graftvision_private.current_platform_user_id() is not null);

drop policy perm_select on public.permission_definition;
create policy perm_select
on public.permission_definition
for select
to authenticated
using (graftvision_private.current_platform_user_id() is not null);

drop policy rp_select on public.role_permission;
create policy rp_select
on public.role_permission
for select
to authenticated
using (graftvision_private.current_platform_user_id() is not null);

create or replace function graftvision_private.has_permission(
  p_actor_id uuid,
  p_clinic_id uuid,
  p_permission_id text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_has boolean;
begin
  if p_clinic_id is not null then
    select true into v_has
    from public.clinic_membership m
    join public.clinic c on m.clinic_id = c.id
    join public.platform_user u on m.platform_user_id = u.id
    join public.clinic_membership_role mr on mr.clinic_membership_id = m.id
    join public.role_permission rp on rp.role_code = mr.role_code
    where u.id = p_actor_id
      and u.status = 'active'
      and c.id = p_clinic_id
      and c.status = 'active'
      and m.membership_status = 'active'
      and rp.permission_id = p_permission_id
    limit 1;
  else
    select true into v_has
    from public.platform_user u
    join public.platform_user_role pr on pr.platform_user_id = u.id
    join public.role_permission rp on rp.role_code = pr.role_code
    where u.id = p_actor_id
      and u.status = 'active'
      and rp.permission_id = p_permission_id
    limit 1;
  end if;

  return coalesce(v_has, false);
end;
$$;

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
  select authorization_version into v_platform_version
  from public.platform_user
  where id = p_platform_user_id and status = 'active';

  if v_platform_version is null then
    raise exception using errcode = '28000', message = 'INVALID_OR_INACTIVE_PLATFORM_USER';
  end if;

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
    p_provider_session_id::uuid,
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

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct',
    'audit.create',
    'authorization.version_increment',
    'clinic.read',
    'membership.create',
    'membership.read',
    'membership.reactivate',
    'membership.suspend',
    'role.assign',
    'role.remove',
    'session.create',
    'session.deny_inactive_user',
    'session.end',
    'session.expire_absolute',
    'session.expire_idle',
    'session.revoke_authorization_change',
    'session.revoke_inactive_membership',
    'session.revoke_inactive_user',
    'session.revoke_other',
    'session.revoke_others',
    'storage_key.validate',
    'system.migration',
    'user.deactivate',
    'user.reactivate'
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
    'clinic_membership_role',
    'platform_user',
    'platform_user_role',
    'storage_object_key',
    'system'
  );
$$;

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
  v_action text;
  v_reason_code text;
begin
  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if not found
    or v_session.revoked_at is not null
    or v_session.absolute_expires_at <= clock_timestamp() then
    return false;
  end if;

  select status, authorization_version
  into v_platform_status, v_platform_version
  from public.platform_user
  where id = v_session.platform_user_id;

  if coalesce(v_platform_status, '') <> 'active' then
    v_action := 'session.revoke_inactive_user';
    v_reason_code := 'DEACTIVATED';
  elsif v_session.platform_authorization_version <> v_platform_version then
    v_action := 'session.revoke_authorization_change';
    v_reason_code := 'REVOKE_ALL';
  elsif v_session.clinic_id is not null then
    select status into v_clinic_status
    from public.clinic
    where id = v_session.clinic_id;

    select membership_status, authorization_version
    into v_membership_status, v_clinic_version
    from public.clinic_membership
    where clinic_id = v_session.clinic_id
      and platform_user_id = v_session.platform_user_id;

    if coalesce(v_clinic_status, '') <> 'active'
      or coalesce(v_membership_status, '') <> 'active' then
      v_action := 'session.revoke_inactive_membership';
      v_reason_code := 'DEACTIVATED';
    elsif v_session.clinic_authorization_version <> v_clinic_version then
      v_action := 'session.revoke_authorization_change';
      v_reason_code := 'REVOKE_ALL';
    end if;
  end if;

  if v_action is null then
    return true;
  end if;

  update public.application_session
  set revoked_at = clock_timestamp(),
      revoke_reason_code = v_reason_code
  where id = p_session_id;

  insert into public.audit_event (
    audit_scope,
    clinic_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    outcome,
    reason_code,
    source_application
  )
  values (
    case when v_session.clinic_id is null then 'platform' else 'clinic' end,
    v_session.clinic_id,
    'system',
    v_action,
    'application_session',
    p_session_id,
    'success',
    v_reason_code,
    'database'
  );

  return false;
end;
$$;

create or replace function public.deactivate_platform_user(p_target_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  if not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.platform_user
  set status = 'suspended',
      authorization_version = authorization_version + 1
  where id = p_target_id;

  insert into public.audit_event (
    audit_scope, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, source_application
  )
  values (
    'platform', v_actor_id, 'user', 'user.deactivate', 'platform_user',
    p_target_id, 'success', 'database'
  );
end;
$$;

create or replace function public.reactivate_platform_user(p_target_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  if not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.platform_user
  set status = 'active',
      authorization_version = authorization_version + 1
  where id = p_target_id;

  insert into public.audit_event (
    audit_scope, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, source_application
  )
  values (
    'platform', v_actor_id, 'user', 'user.reactivate', 'platform_user',
    p_target_id, 'success', 'database'
  );
end;
$$;

create or replace function public.deactivate_clinic_membership(p_membership_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
  v_clinic_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_membership
  where id = p_membership_id;

  if v_clinic_id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'ADMIN-PERM-003')
    and not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.clinic_membership
  set membership_status = 'suspended',
      authorization_version = authorization_version + 1
  where id = p_membership_id;

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, source_application
  )
  values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'membership.suspend',
    'clinic_membership', p_membership_id, 'success', 'database'
  );
end;
$$;

create or replace function public.reactivate_clinic_membership(p_membership_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
  v_clinic_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_membership
  where id = p_membership_id;

  if v_clinic_id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not graftvision_private.has_permission(v_actor_id, v_clinic_id, 'ADMIN-PERM-003')
    and not graftvision_private.has_permission(v_actor_id, null, 'ADMIN-PERM-004') then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  update public.clinic_membership
  set membership_status = 'active',
      authorization_version = authorization_version + 1
  where id = p_membership_id;

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, source_application
  )
  values (
    'clinic', v_clinic_id, v_actor_id, 'user', 'membership.reactivate',
    'clinic_membership', p_membership_id, 'success', 'database'
  );
end;
$$;

revoke all on function public.deactivate_platform_user(uuid) from public, anon, authenticated;
revoke all on function public.reactivate_platform_user(uuid) from public, anon, authenticated;
revoke all on function public.deactivate_clinic_membership(uuid) from public, anon, authenticated;
revoke all on function public.reactivate_clinic_membership(uuid) from public, anon, authenticated;
