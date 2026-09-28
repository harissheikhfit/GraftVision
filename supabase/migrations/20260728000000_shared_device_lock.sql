-- GraftVision migration
-- Task: AUTH-004
-- Purpose: Add server-owned shared-device locking and password-reauthentication state.
-- Created UTC: 20260728000000
-- graftvision:dangerous-sql-approved task=AUTH-004
-- graftvision:dangerous-sql-reason Reviewed session-state constraints, function replacement, and transition audit writes.
-- graftvision:corrective-plan Restore from the pre-migration snapshot if the session-state transition fails.

alter table public.application_session
  add column locked_at timestamptz,
  add column lock_reason_code text,
  add column reauthenticated_at timestamptz,
  add constraint application_session_lock_state_check
    check (
      (locked_at is null and lock_reason_code is null)
      or
      (locked_at is not null and lock_reason_code in ('IDLE', 'MANUAL'))
    );

create index application_session_locked_idx
  on public.application_session (id, locked_at)
  where locked_at is not null and revoked_at is null;

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
    'doctor.verification.expired',
    'doctor.verification.pending',
    'doctor.verification.rejected',
    'doctor.verification.revoked',
    'doctor.verification.verified',
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
    'session.lock',
    'session.logout_after_lock',
    'session.reauthentication_failed',
    'session.revoke_authorization_change',
    'session.revoke_inactive_membership',
    'session.revoke_inactive_user',
    'session.revoke_other',
    'session.revoke_others',
    'session.unlock',
    'storage_key.validate',
    'system.migration',
    'user.deactivate',
    'user.reactivate'
  );
$$;

alter function graftvision_private.validate_application_session(uuid)
  rename to validate_application_session_authority_state;

create function graftvision_private.lock_application_session(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_reason_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_reason_code not in ('IDLE', 'MANUAL') then
    return false;
  end if;

  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if not found
    or v_session.platform_user_id <> p_provider_identity_id
    or v_session.revoked_at is not null
    or v_session.absolute_expires_at <= v_now then
    return false;
  end if;

  if v_session.locked_at is not null then
    return true;
  end if;

  if p_reason_code = 'IDLE'
    and v_session.last_activity_at > v_now - interval '30 minutes' then
    return false;
  end if;

  update public.application_session
  set locked_at = v_now,
      lock_reason_code = p_reason_code,
      updated_at = v_now
  where id = p_session_id;

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
    source_application
  )
  values (
    v_session.authority_scope,
    v_session.clinic_id,
    case when p_reason_code = 'IDLE' then null else v_session.platform_user_id end,
    case when p_reason_code = 'IDLE' then 'system' else 'user' end,
    'session.lock',
    'application_session',
    p_session_id,
    'success',
    p_reason_code,
    'database'
  );

  return true;
end;
$$;

revoke all on function graftvision_private.lock_application_session(uuid, uuid, text)
  from public, anon, authenticated;

create function graftvision_private.validate_application_session(p_session_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
begin
  select * into v_session
  from public.application_session
  where id = p_session_id;

  if not found or v_session.locked_at is not null then
    return false;
  end if;

  if v_session.last_activity_at <= clock_timestamp() - interval '30 minutes' then
    perform graftvision_private.lock_application_session(
      p_session_id,
      v_session.platform_user_id,
      'IDLE'
    );
    return false;
  end if;

  return graftvision_private.validate_application_session_authority_state(p_session_id);
end;
$$;

revoke all on function graftvision_private.validate_application_session(uuid)
  from public, anon, authenticated;
revoke all on function graftvision_private.validate_application_session_authority_state(uuid)
  from public, anon, authenticated;

create function graftvision_private.unlock_application_session(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_expected_scope text,
  p_expected_clinic_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if not found
    or v_session.locked_at is null
    or v_session.revoked_at is not null
    or v_session.absolute_expires_at <= v_now
    or v_session.platform_user_id <> p_provider_identity_id
    or v_session.authority_scope <> p_expected_scope
    or v_session.clinic_id is distinct from p_expected_clinic_id then
    return false;
  end if;

  if not graftvision_private.validate_application_session_authority_state(p_session_id) then
    return false;
  end if;

  update public.application_session
  set locked_at = null,
      lock_reason_code = null,
      reauthenticated_at = v_now,
      last_activity_at = v_now,
      updated_at = v_now
  where id = p_session_id;

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
    source_application
  )
  values (
    v_session.authority_scope,
    v_session.clinic_id,
    v_session.platform_user_id,
    'user',
    'session.unlock',
    'application_session',
    p_session_id,
    'success',
    'PASSWORD_REAUTHENTICATED',
    'database'
  );

  return true;
end;
$$;

revoke all on function graftvision_private.unlock_application_session(uuid, uuid, text, uuid)
  from public, anon, authenticated;

create function graftvision_private.record_session_reauthentication_failed(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
begin
  select * into v_session
  from public.application_session
  where id = p_session_id;

  if not found
    or v_session.platform_user_id <> p_provider_identity_id
    or v_session.locked_at is null
    or v_session.revoked_at is not null then
    return false;
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
    source_application
  )
  values (
    v_session.authority_scope,
    v_session.clinic_id,
    v_session.platform_user_id,
    'user',
    'session.reauthentication_failed',
    'application_session',
    p_session_id,
    'failure',
    'INVALID_CREDENTIALS',
    'database'
  );

  return true;
end;
$$;

revoke all on function graftvision_private.record_session_reauthentication_failed(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.logout_locked_application_session(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if not found
    or v_session.platform_user_id <> p_provider_identity_id
    or v_session.locked_at is null
    or v_session.revoked_at is not null then
    return false;
  end if;

  update public.application_session
  set revoked_at = v_now,
      revoke_reason_code = 'LOGOUT',
      updated_at = v_now
  where id = p_session_id;

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
    source_application
  )
  values (
    v_session.authority_scope,
    v_session.clinic_id,
    v_session.platform_user_id,
    'user',
    'session.logout_after_lock',
    'application_session',
    p_session_id,
    'success',
    'LOGOUT',
    'database'
  );

  return true;
end;
$$;

revoke all on function graftvision_private.logout_locked_application_session(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.record_application_session_activity(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.application_session%rowtype;
begin
  if not graftvision_private.validate_application_session(p_session_id) then
    return false;
  end if;

  select * into v_session
  from public.application_session
  where id = p_session_id
  for update;

  if v_session.platform_user_id <> p_provider_identity_id then
    return false;
  end if;

  update public.application_session
  set last_activity_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id
    and locked_at is null
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function graftvision_private.record_application_session_activity(uuid, uuid)
  from public, anon, authenticated;
