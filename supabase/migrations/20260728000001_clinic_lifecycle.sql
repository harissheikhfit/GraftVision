-- GraftVision migration
-- Task: CLINIC-001
-- Purpose: Add controlled platform-only clinic creation and MVP lifecycle transitions.
-- Created UTC: 20260728000001
-- graftvision:dangerous-sql-approved task=CLINIC-001
-- graftvision:dangerous-sql-reason Reviewed legacy archived-to-inactive mapping, status constraints, and controlled lifecycle writes.
-- graftvision:corrective-plan Forward-fix the lifecycle boundary from a reviewed snapshot; historical migrations remain unchanged.

update public.clinic
set status = 'inactive',
    updated_at = timezone('utc', statement_timestamp())
where status = 'archived';

alter table public.clinic
  drop constraint clinic_status_check,
  drop constraint clinic_check,
  add constraint clinic_status_check
    check (status in ('active', 'suspended', 'inactive'));

comment on table public.clinic is
  'Root tenant record. Creation and MVP status transitions are controlled platform operations; deletion is deferred.';

create table public.clinic_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  previous_status text,
  new_status text not null,
  reason_code text not null,
  actor_platform_user_id uuid not null,
  audit_event_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint clinic_status_history_clinic_fk
    foreign key (clinic_id) references public.clinic (id)
    on update restrict on delete restrict,
  constraint clinic_status_history_actor_fk
    foreign key (actor_platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict,
  constraint clinic_status_history_audit_fk
    foreign key (audit_event_id) references public.audit_event (id)
    on update restrict on delete restrict,
  constraint clinic_status_history_previous_status_check
    check (previous_status is null or previous_status in ('active', 'suspended', 'inactive')),
  constraint clinic_status_history_new_status_check
    check (new_status in ('active', 'suspended', 'inactive')),
  constraint clinic_status_history_reason_code_check
    check (
      reason_code in (
        'PLATFORM_APPROVED',
        'OPERATIONAL_HOLD',
        'OPERATIONAL_RESOLVED',
        'PLATFORM_INACTIVATED'
      )
    )
);

create index clinic_status_history_clinic_occurred_idx
  on public.clinic_status_history (clinic_id, occurred_at desc);

comment on table public.clinic_status_history is
  'Immutable history written only by controlled CLINIC-001 lifecycle procedures.';

alter table public.clinic_status_history enable row level security;
alter table public.clinic_status_history force row level security;

revoke all on table public.clinic_status_history from public, anon, authenticated;

create function graftvision_private.prevent_clinic_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'CLINIC_STATUS_HISTORY_IMMUTABLE';
end;
$$;

revoke all on function graftvision_private.prevent_clinic_history_mutation()
  from public, anon, authenticated;

create trigger clinic_status_history_prevent_mutation
before update or delete on public.clinic_status_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create function graftvision_private.enforce_controlled_clinic_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinic_code is distinct from old.clinic_code then
    raise exception using errcode = '55000', message = 'CLINIC_CODE_IMMUTABLE';
  end if;

  if new.status is distinct from old.status
    and current_setting('graftvision.clinic_lifecycle_controlled', true) <> 'on' then
    raise exception using
      errcode = '55000',
      message = 'CLINIC_LIFECYCLE_CONTROLLED_TRANSITION_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function graftvision_private.enforce_controlled_clinic_update()
  from public, anon, authenticated;

create trigger clinic_enforce_controlled_update
before update of clinic_code, status on public.clinic
for each row execute function graftvision_private.enforce_controlled_clinic_update();

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
    'clinic.create',
    'clinic.inactivate',
    'clinic.read',
    'clinic.reactivate',
    'clinic.suspend',
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

create function graftvision_private.has_clinic_lifecycle_authority(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    graftvision_private.has_application_session_permission(
      p_session_id,
      p_provider_identity_id,
      'platform',
      null,
      'ADMIN-PERM-006'
    )
    and exists (
      select 1
      from public.application_session s
      join public.platform_user_role pur
        on pur.platform_user_id = s.platform_user_id
      where s.id = p_session_id
        and s.platform_user_id = p_provider_identity_id
        and s.authority_scope = 'platform'
        and pur.role_code in ('PLATFORM_OWNER', 'PLATFORM_ADMIN')
    );
$$;

revoke all on function graftvision_private.has_clinic_lifecycle_authority(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.create_clinic(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_code text,
  p_display_name text,
  p_initial_status text,
  p_reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_audit_event_id uuid;
  v_code text := lower(btrim(p_clinic_code));
  v_name text := btrim(p_display_name);
begin
  if not graftvision_private.has_clinic_lifecycle_authority(
    p_session_id,
    p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  if p_clinic_code is null
    or p_clinic_code <> v_code
    or v_code !~ '^[a-z][a-z0-9-]{2,62}$'
    or v_code in (
      'admin', 'api', 'app', 'auth', 'clinic', 'graftvision',
      'platform', 'public', 'root', 'support', 'system'
    ) then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_CODE';
  end if;

  if p_display_name is null
    or p_display_name <> v_name
    or length(v_name) not between 1 and 160
    or v_name ~ '[[:cntrl:]]'
    or lower(v_name) in ('null', 'test', 'undefined', 'unknown', 'unnamed') then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_NAME';
  end if;

  if p_initial_status not in ('active', 'suspended', 'inactive')
    or p_reason_code <> 'PLATFORM_APPROVED' then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_INITIAL_STATE';
  end if;

  insert into public.clinic (clinic_code, display_name, status)
  values (v_code, v_name, p_initial_status)
  returning id into v_clinic_id;

  insert into public.audit_event (
    audit_scope,
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
    'platform',
    p_provider_identity_id,
    'user',
    'clinic.create',
    'clinic',
    v_clinic_id,
    'success',
    p_reason_code,
    'database',
    jsonb_build_object('new_status', p_initial_status)
  )
  returning id into v_audit_event_id;

  insert into public.clinic_status_history (
    clinic_id,
    previous_status,
    new_status,
    reason_code,
    actor_platform_user_id,
    audit_event_id
  )
  values (
    v_clinic_id,
    null,
    p_initial_status,
    p_reason_code,
    p_provider_identity_id,
    v_audit_event_id
  );

  return v_clinic_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'CLINIC_CODE_ALREADY_EXISTS';
end;
$$;

revoke all on function graftvision_private.create_clinic(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;

create function graftvision_private.transition_clinic_status(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_id uuid,
  p_new_status text,
  p_reason_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_status text;
  v_action text;
  v_audit_event_id uuid;
begin
  if not graftvision_private.has_clinic_lifecycle_authority(
    p_session_id,
    p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  select status into v_previous_status
  from public.clinic
  where id = p_clinic_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'CLINIC_NOT_FOUND';
  end if;

  if v_previous_status = 'active'
    and p_new_status = 'suspended'
    and p_reason_code = 'OPERATIONAL_HOLD' then
    v_action := 'clinic.suspend';
  elsif v_previous_status = 'suspended'
    and p_new_status = 'active'
    and p_reason_code = 'OPERATIONAL_RESOLVED' then
    v_action := 'clinic.reactivate';
  elsif v_previous_status in ('active', 'suspended')
    and p_new_status = 'inactive'
    and p_reason_code = 'PLATFORM_INACTIVATED' then
    v_action := 'clinic.inactivate';
  else
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_STATUS_TRANSITION';
  end if;

  perform set_config('graftvision.clinic_lifecycle_controlled', 'on', true);

  update public.clinic
  set status = p_new_status,
      archived_at = null,
      updated_at = timezone('utc', statement_timestamp())
  where id = p_clinic_id;

  perform set_config('graftvision.clinic_lifecycle_controlled', 'off', true);

  update public.clinic_membership
  set authorization_version = authorization_version + 1,
      updated_at = timezone('utc', statement_timestamp())
  where clinic_id = p_clinic_id;

  insert into public.audit_event (
    audit_scope,
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
    'platform',
    p_provider_identity_id,
    'user',
    v_action,
    'clinic',
    p_clinic_id,
    'success',
    p_reason_code,
    'database',
    jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', p_new_status
    )
  )
  returning id into v_audit_event_id;

  insert into public.clinic_status_history (
    clinic_id,
    previous_status,
    new_status,
    reason_code,
    actor_platform_user_id,
    audit_event_id
  )
  values (
    p_clinic_id,
    v_previous_status,
    p_new_status,
    p_reason_code,
    p_provider_identity_id,
    v_audit_event_id
  );

  return true;
end;
$$;

revoke all on function graftvision_private.transition_clinic_status(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
