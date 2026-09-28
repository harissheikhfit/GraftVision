-- GraftVision migration
-- Task: RBAC-002
-- Purpose: Bind every application session and permission decision to one explicit authority scope.
-- Created UTC: 20260727000004
-- graftvision:dangerous-sql-approved task=RBAC-002
-- graftvision:dangerous-sql-reason Reviewed legacy-session scope backfill and scope-rotation revocation.
-- graftvision:corrective-plan Restore from the pre-migration snapshot if the scope backfill fails.

alter table public.application_session
  add column authority_scope text;

-- One-time conversion of sessions created before RBAC-002. Runtime authority never
-- infers scope from clinic_id after this constraint is installed.
update public.application_session
set authority_scope = case when clinic_id is null then 'platform' else 'clinic' end;

alter table public.application_session
  alter column authority_scope set not null,
  add constraint application_session_authority_scope_check
    check (authority_scope in ('platform', 'clinic')),
  add constraint application_session_scope_clinic_check
    check (
      (authority_scope = 'platform' and clinic_id is null) or
      (authority_scope = 'clinic' and clinic_id is not null)
    );

alter table public.application_session
  drop constraint application_session_revoke_reason_code_check,
  add constraint application_session_revoke_reason_code_check
    check (
      revoke_reason_code in (
        'LOGOUT',
        'REVOKE_ONE',
        'REVOKE_ALL',
        'DEACTIVATED',
        'SCOPE_CHANGE'
      )
    );

create index application_session_authority_scope_idx
  on public.application_session (platform_user_id, authority_scope, clinic_id);

create or replace function graftvision_private.is_platform_metadata_permission(
  candidate text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'TENANT-ACCESS-002',
    'ADMIN-PERM-004',
    'ADMIN-PERM-005',
    'ADMIN-PERM-006',
    'AUDIT-PERM-001',
    'ROLE-010',
    'EXPORT-PERM-002',
    'SUPPORT-PERM-002',
    'SUPPORT-PERM-003'
  );
$$;

revoke all on function graftvision_private.is_platform_metadata_permission(text)
  from public, anon, authenticated;

drop function graftvision_private.create_application_session(
  uuid, uuid, text, timestamptz, text, text
);

create function graftvision_private.create_application_session(
  p_platform_user_id uuid,
  p_authority_scope text,
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
  if p_authority_scope not in ('platform', 'clinic')
    or (p_authority_scope = 'platform' and p_clinic_id is not null)
    or (p_authority_scope = 'clinic' and p_clinic_id is null) then
    raise exception using errcode = '22023', message = 'INVALID_AUTHORITY_SCOPE';
  end if;

  select authorization_version into v_platform_version
  from public.platform_user
  where id = p_platform_user_id
    and status = 'active';

  if v_platform_version is null then
    raise exception using errcode = '28000', message = 'INVALID_OR_INACTIVE_PLATFORM_USER';
  end if;

  if p_authority_scope = 'platform' then
    if not exists (
      select 1
      from public.platform_user_role pur
      join public.role_definition rd on rd.role_code = pur.role_code
      where pur.platform_user_id = p_platform_user_id
        and rd.role_type = 'platform'
    ) then
      raise exception using errcode = '42501', message = 'ACTIVE_PLATFORM_ROLE_REQUIRED';
    end if;
  else
    select m.authorization_version into v_clinic_version
    from public.clinic_membership m
    join public.clinic c on c.id = m.clinic_id
    where m.platform_user_id = p_platform_user_id
      and m.clinic_id = p_clinic_id
      and m.membership_status = 'active'
      and c.status = 'active'
      and exists (
        select 1
        from public.clinic_membership_role cmr
        join public.role_definition rd on rd.role_code = cmr.role_code
        where cmr.clinic_membership_id = m.id
          and rd.role_type = 'clinic'
      );

    if v_clinic_version is null then
      raise exception using errcode = '28000', message = 'ACTIVE_CLINIC_ROLE_REQUIRED';
    end if;
  end if;

  insert into public.application_session (
    platform_user_id,
    authority_scope,
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
    p_authority_scope,
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

revoke all on function graftvision_private.create_application_session(
  uuid, text, uuid, text, timestamptz, text, text
) from public, anon, authenticated;

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct',
    'audit.create',
    'authority.cross_scope_denied',
    'authority.scope_change',
    'authorization.version_increment',
    'clinic.read',
    'membership.create',
    'membership.read',
    'membership.reactivate',
    'membership.suspend',
    'platform.admin',
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
  v_has_active_role boolean;
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

  if v_session.authority_scope not in ('platform', 'clinic')
    or (v_session.authority_scope = 'platform' and v_session.clinic_id is not null)
    or (v_session.authority_scope = 'clinic' and v_session.clinic_id is null) then
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
  elsif v_session.authority_scope = 'platform' then
    select exists (
      select 1
      from public.platform_user_role pur
      join public.role_definition rd on rd.role_code = pur.role_code
      where pur.platform_user_id = v_session.platform_user_id
        and rd.role_type = 'platform'
    ) into v_has_active_role;

    if not v_has_active_role then
      v_action := 'session.revoke_authorization_change';
      v_reason_code := 'REVOKE_ALL';
    end if;
  else
    select status into v_clinic_status
    from public.clinic
    where id = v_session.clinic_id;

    select m.membership_status, m.authorization_version,
      exists (
        select 1
        from public.clinic_membership_role cmr
        join public.role_definition rd on rd.role_code = cmr.role_code
        where cmr.clinic_membership_id = m.id
          and rd.role_type = 'clinic'
      )
    into v_membership_status, v_clinic_version, v_has_active_role
    from public.clinic_membership m
    where m.clinic_id = v_session.clinic_id
      and m.platform_user_id = v_session.platform_user_id;

    if coalesce(v_clinic_status, '') <> 'active'
      or coalesce(v_membership_status, '') <> 'active'
      or not coalesce(v_has_active_role, false) then
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
      revoke_reason_code = v_reason_code,
      updated_at = clock_timestamp()
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
    v_session.authority_scope,
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

create function graftvision_private.has_application_session_permission(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_required_scope text,
  p_required_clinic_id uuid,
  p_permission_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_allowed boolean := false;
  v_high_risk_denial boolean := false;
begin
  if p_required_scope not in ('platform', 'clinic') then
    return false;
  end if;

  if not graftvision_private.validate_application_session(p_session_id) then
    return false;
  end if;

  select * into v_session
  from public.application_session
  where id = p_session_id;

  if not found
    or v_session.platform_user_id <> p_provider_identity_id
    or v_session.authority_scope <> p_required_scope
    or (p_required_scope = 'platform' and p_required_clinic_id is not null)
    or (
      p_required_scope = 'clinic'
      and (
        p_required_clinic_id is null
        or v_session.clinic_id <> p_required_clinic_id
      )
    ) then
    v_high_risk_denial := true;
  elsif p_required_scope = 'platform' then
    if not graftvision_private.is_platform_metadata_permission(p_permission_id) then
      v_high_risk_denial := true;
    else
      select exists (
        select 1
        from public.platform_user u
        join public.platform_user_role pur on pur.platform_user_id = u.id
        join public.role_definition rd
          on rd.role_code = pur.role_code
          and rd.role_type = 'platform'
        join public.role_permission rp on rp.role_code = pur.role_code
        where u.id = v_session.platform_user_id
          and u.status = 'active'
          and rp.permission_id = p_permission_id
      ) into v_allowed;
    end if;
  else
    select exists (
      select 1
      from public.platform_user u
      join public.clinic_membership m
        on m.platform_user_id = u.id
        and m.clinic_id = v_session.clinic_id
      join public.clinic c on c.id = m.clinic_id
      join public.clinic_membership_role cmr on cmr.clinic_membership_id = m.id
      join public.role_definition rd
        on rd.role_code = cmr.role_code
        and rd.role_type = 'clinic'
      join public.role_permission rp on rp.role_code = cmr.role_code
      where u.id = v_session.platform_user_id
        and u.status = 'active'
        and c.status = 'active'
        and m.membership_status = 'active'
        and rp.permission_id = p_permission_id
    ) into v_allowed;
  end if;

  if v_high_risk_denial then
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
      source_application,
      metadata
    )
    values (
      v_session.authority_scope,
      v_session.clinic_id,
      v_session.platform_user_id,
      'user',
      'authority.cross_scope_denied',
      'application_session',
      p_session_id,
      'denied',
      'AUTHORITY_SCOPE_MISMATCH',
      'database',
      jsonb_build_object(
        'policy_decision_code', 'AUTHORITY_SCOPE_MISMATCH',
        'route_family', p_required_scope
      )
    );
  end if;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function graftvision_private.has_application_session_permission(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated;

create function graftvision_private.rotate_application_session_authority(
  p_current_session_id uuid,
  p_provider_identity_id uuid,
  p_new_authority_scope text,
  p_new_clinic_id uuid,
  p_absolute_expires_at timestamptz,
  p_device_label text,
  p_user_agent_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_session public.application_session%rowtype;
  v_new_session_id uuid;
begin
  if not graftvision_private.validate_application_session(p_current_session_id) then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select * into strict v_current_session
  from public.application_session
  where id = p_current_session_id
  for update;

  if v_current_session.platform_user_id <> p_provider_identity_id then
    raise exception using errcode = '42501', message = 'AUTHORITY_CONTEXT_MISMATCH';
  end if;

  v_new_session_id := graftvision_private.create_application_session(
    v_current_session.platform_user_id,
    p_new_authority_scope,
    p_new_clinic_id,
    v_current_session.provider_session_id::text,
    p_absolute_expires_at,
    p_device_label,
    p_user_agent_hash
  );

  update public.application_session
  set revoked_at = clock_timestamp(),
      revoke_reason_code = 'SCOPE_CHANGE',
      updated_at = clock_timestamp()
  where id = p_current_session_id;

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
    source_application,
    metadata
  )
  values (
    v_current_session.authority_scope,
    v_current_session.clinic_id,
    v_current_session.platform_user_id,
    'user',
    'authority.scope_change',
    'application_session',
    v_new_session_id,
    'success',
    'SCOPE_CHANGE',
    'database',
    jsonb_build_object(
      'previous_status', v_current_session.authority_scope,
      'new_status', p_new_authority_scope
    )
  );

  return v_new_session_id;
end;
$$;

revoke all on function graftvision_private.rotate_application_session_authority(
  uuid, uuid, text, uuid, timestamptz, text, text
) from public, anon, authenticated;

