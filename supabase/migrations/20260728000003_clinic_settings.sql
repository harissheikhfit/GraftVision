-- GraftVision migration
-- Task: CLINIC-002
-- Purpose: Add typed clinic profile settings, optimistic concurrency, and immutable history.
-- Created UTC: 20260728000003
-- graftvision:dangerous-sql-approved task=CLINIC-002
-- graftvision:dangerous-sql-reason Reviewed typed clinic columns, controlled updates, function replacement, and immutable history.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

alter table public.clinic
  add column timezone text,
  add column revision integer not null default 1,
  add column updated_by_platform_user_id uuid
    references public.platform_user(id) on update restrict on delete restrict;

update public.clinic set timezone = 'Asia/Karachi' where timezone is null;

alter table public.clinic
  alter column timezone set not null,
  alter column timezone set default 'Asia/Karachi',
  add constraint clinic_timezone_length_check check (length(timezone) between 1 and 64),
  add constraint clinic_revision_check check (revision >= 1);

create table public.clinic_settings_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  previous_revision integer not null,
  new_revision integer not null,
  changed_fields text[] not null,
  reason_code text not null check (reason_code = 'PROFILE_UPDATED'),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  check (new_revision = previous_revision + 1),
  check (cardinality(changed_fields) between 1 and 2),
  check (changed_fields <@ array['display_name', 'timezone']::text[])
);

create index clinic_settings_history_clinic_revision_idx
  on public.clinic_settings_history (clinic_id, new_revision desc);

alter table public.clinic_settings_history enable row level security;
alter table public.clinic_settings_history force row level security;
revoke all on table public.clinic_settings_history from public, anon, authenticated;

create trigger clinic_settings_history_immutable
before update or delete on public.clinic_settings_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create function graftvision_private.enforce_controlled_clinic_settings_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.display_name is distinct from old.display_name
    or new.timezone is distinct from old.timezone
    or new.revision is distinct from old.revision
    or new.updated_by_platform_user_id is distinct from old.updated_by_platform_user_id
  ) and current_setting('graftvision.clinic_settings_controlled', true) <> 'on' then
    raise exception using errcode = '55000', message = 'CLINIC_SETTINGS_CONTROLLED_UPDATE_REQUIRED';
  end if;
  return new;
end;
$$;

revoke all on function graftvision_private.enforce_controlled_clinic_settings_update()
  from public, anon, authenticated;

create trigger clinic_enforce_controlled_settings_update
before update of display_name, timezone, revision, updated_by_platform_user_id on public.clinic
for each row execute function graftvision_private.enforce_controlled_clinic_settings_update();

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.create', 'clinic.inactivate', 'clinic.read',
    'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
    'clinic.settings_view', 'clinic.suspend', 'doctor.verification.expired',
    'doctor.verification.pending', 'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate',
    'membership.read', 'membership.reactivate', 'membership.role_assign',
    'membership.role_remove', 'membership.suspend', 'platform.admin', 'role.assign',
    'role.remove', 'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock',
    'session.logout_after_lock', 'session.reauthentication_failed',
    'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other', 'session.revoke_others',
    'session.unlock', 'storage_key.validate', 'system.migration', 'user.deactivate',
    'user.reactivate'
  );
$$;

create function graftvision_private.has_clinic_settings_authority(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select graftvision_private.has_application_session_permission(
    p_session_id,
    p_provider_identity_id,
    'clinic',
    (select clinic_id from public.application_session where id = p_session_id),
    'ADMIN-PERM-001'
  );
$$;

revoke all on function graftvision_private.has_clinic_settings_authority(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.is_valid_iana_timezone(p_timezone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_timezone is not null
    and length(p_timezone) between 1 and 64
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone);
$$;

revoke all on function graftvision_private.is_valid_iana_timezone(text)
  from public, anon, authenticated;

create function graftvision_private.read_clinic_settings(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (
  clinic_id uuid,
  clinic_code text,
  display_name text,
  timezone text,
  revision integer,
  updated_at timestamptz,
  updated_by_platform_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
begin
  if not graftvision_private.has_clinic_settings_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.settings_view',
    'clinic', v_clinic_id, 'success', 'SETTINGS_VIEWED', 'database', '{}'::jsonb
  );
  return query
  select c.id, c.clinic_code, c.display_name, c.timezone, c.revision,
    c.updated_at, c.updated_by_platform_user_id
  from public.clinic c where c.id = v_clinic_id;
end;
$$;

revoke all on function graftvision_private.read_clinic_settings(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.update_clinic_settings(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_expected_revision integer,
  p_display_name text,
  p_timezone text,
  p_reason_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic public.clinic%rowtype;
  v_name text := btrim(p_display_name);
  v_changed_fields text[];
begin
  if not graftvision_private.has_clinic_settings_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_display_name is null
    or p_display_name <> v_name
    or length(v_name) not between 1 and 160
    or v_name ~ '[[:cntrl:]]'
    or lower(v_name) in ('null', 'test', 'undefined', 'unknown', 'unnamed') then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_NAME';
  end if;
  if not graftvision_private.is_valid_iana_timezone(p_timezone) then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_TIMEZONE';
  end if;
  if p_reason_code <> 'PROFILE_UPDATED' then
    raise exception using errcode = '22023', message = 'INVALID_SETTINGS_REASON';
  end if;

  select c.* into v_clinic
  from public.clinic c
  where c.id = (select s.clinic_id from public.application_session s where s.id = p_session_id)
  for update;

  if v_clinic.revision <> p_expected_revision then
    insert into public.audit_event (
      audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
      resource_type, resource_id, outcome, reason_code, source_application, metadata
    ) values (
      'clinic', v_clinic.id, p_provider_identity_id, 'user', 'clinic.settings_conflict',
      'clinic', v_clinic.id, 'denied', 'REVISION_CONFLICT', 'database',
      '{}'::jsonb
    );
    return 'conflict';
  end if;

  select array_agg(field_name order by field_name) into v_changed_fields
  from (
    select 'display_name' field_name where v_clinic.display_name is distinct from v_name
    union all
    select 'timezone' field_name where v_clinic.timezone is distinct from p_timezone
  ) changes;
  if coalesce(cardinality(v_changed_fields), 0) = 0 then
    return 'unchanged';
  end if;

  perform set_config('graftvision.clinic_settings_controlled', 'on', true);
  update public.clinic
  set display_name = v_name,
      timezone = p_timezone,
      revision = revision + 1,
      updated_at = timezone('utc', statement_timestamp()),
      updated_by_platform_user_id = p_provider_identity_id
  where id = v_clinic.id;
  perform set_config('graftvision.clinic_settings_controlled', 'off', true);

  insert into public.clinic_settings_history (
    clinic_id, previous_revision, new_revision, changed_fields,
    reason_code, actor_platform_user_id
  ) values (
    v_clinic.id, v_clinic.revision, v_clinic.revision + 1, v_changed_fields,
    p_reason_code, p_provider_identity_id
  );
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic.id, p_provider_identity_id, 'user', 'clinic.settings_update',
    'clinic', v_clinic.id, 'success', p_reason_code, 'database',
    jsonb_build_object('changed_fields', v_changed_fields)
  );
  return 'updated';
end;
$$;

revoke all on function graftvision_private.update_clinic_settings(
  uuid, uuid, integer, text, text, text
) from public, anon, authenticated;

create function graftvision_private.create_clinic_with_settings(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_code text,
  p_display_name text,
  p_timezone text,
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
begin
  if not graftvision_private.is_valid_iana_timezone(p_timezone) then
    raise exception using errcode = '22023', message = 'INVALID_CLINIC_TIMEZONE';
  end if;
  perform set_config('graftvision.clinic_settings_controlled', 'on', true);
  v_clinic_id := graftvision_private.create_clinic(
    p_session_id, p_provider_identity_id, p_clinic_code,
    p_display_name, p_initial_status, p_reason_code
  );
  update public.clinic
  set timezone = p_timezone,
      updated_by_platform_user_id = p_provider_identity_id
  where id = v_clinic_id;
  perform set_config('graftvision.clinic_settings_controlled', 'off', true);
  return v_clinic_id;
end;
$$;

revoke all on function graftvision_private.create_clinic_with_settings(
  uuid, uuid, text, text, text, text, text
) from public, anon, authenticated;
