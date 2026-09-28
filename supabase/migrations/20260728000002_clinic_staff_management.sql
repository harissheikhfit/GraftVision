-- GraftVision migration
-- Task: CLINIC-004
-- Purpose: Add controlled clinic invitation and staff-management state.
-- Created UTC: 20260728000002
-- graftvision:dangerous-sql-approved task=CLINIC-004
-- graftvision:dangerous-sql-reason Reviewed controlled membership/role writes, function replacement, and immutable histories.
-- graftvision:corrective-plan Forward-fix from a reviewed snapshot; historical migrations remain unchanged.

create table public.clinic_invitation (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  normalized_email text not null,
  provider_reference_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_platform_user_id uuid references public.platform_user(id) on update restrict on delete restrict,
  created_by_platform_user_id uuid not null references public.platform_user(id) on update restrict on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (normalized_email = lower(btrim(normalized_email))),
  check (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (length(normalized_email) between 3 and 254),
  check (provider_reference_hash ~ '^[a-f0-9]{64}$'),
  check (
    (status = 'accepted' and accepted_platform_user_id is not null)
    or (status <> 'accepted' and accepted_platform_user_id is null)
  )
);

create unique index clinic_invitation_pending_email_unique
  on public.clinic_invitation (clinic_id, normalized_email)
  where status = 'pending';

create index clinic_invitation_clinic_status_idx
  on public.clinic_invitation (clinic_id, status, expires_at);

create table public.clinic_invitation_role (
  invitation_id uuid not null references public.clinic_invitation(id) on update restrict on delete restrict,
  role_code text not null references public.role_definition(role_code) on update restrict on delete restrict,
  primary key (invitation_id, role_code)
);

create table public.clinic_invitation_history (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.clinic_invitation(id) on update restrict on delete restrict,
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  action text not null check (action in ('created', 'resent', 'revoked', 'accepted', 'expired')),
  previous_status text check (previous_status is null or previous_status in ('pending', 'accepted', 'revoked', 'expired')),
  new_status text not null check (new_status in ('pending', 'accepted', 'revoked', 'expired')),
  actor_platform_user_id uuid not null references public.platform_user(id) on update restrict on delete restrict,
  audit_event_id uuid not null references public.audit_event(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp()
);

create index clinic_invitation_history_invitation_idx
  on public.clinic_invitation_history (invitation_id, occurred_at);

create table public.clinic_staff_management_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  clinic_membership_id uuid not null references public.clinic_membership(id) on update restrict on delete restrict,
  action text not null check (action in ('roles_changed', 'deactivated', 'reactivated', 'owner_bootstrapped')),
  previous_roles text[] not null default '{}',
  new_roles text[] not null default '{}',
  previous_membership_status text not null,
  new_membership_status text not null,
  actor_platform_user_id uuid not null references public.platform_user(id) on update restrict on delete restrict,
  audit_event_id uuid not null references public.audit_event(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  check (previous_membership_status in ('active', 'suspended', 'revoked')),
  check (new_membership_status in ('active', 'suspended', 'revoked'))
);

create index clinic_staff_history_membership_idx
  on public.clinic_staff_management_history (clinic_membership_id, occurred_at);

alter table public.clinic_invitation enable row level security;
alter table public.clinic_invitation force row level security;
alter table public.clinic_invitation_role enable row level security;
alter table public.clinic_invitation_role force row level security;
alter table public.clinic_invitation_history enable row level security;
alter table public.clinic_invitation_history force row level security;
alter table public.clinic_staff_management_history enable row level security;
alter table public.clinic_staff_management_history force row level security;

revoke all on table public.clinic_invitation from public, anon, authenticated;
revoke all on table public.clinic_invitation_role from public, anon, authenticated;
revoke all on table public.clinic_invitation_history from public, anon, authenticated;
revoke all on table public.clinic_staff_management_history from public, anon, authenticated;

create function graftvision_private.prevent_clinic_staff_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'CLINIC_STAFF_HISTORY_IMMUTABLE';
end;
$$;

revoke all on function graftvision_private.prevent_clinic_staff_history_mutation()
  from public, anon, authenticated;

create trigger clinic_invitation_history_immutable
before update or delete on public.clinic_invitation_history
for each row execute function graftvision_private.prevent_clinic_staff_history_mutation();

create trigger clinic_staff_management_history_immutable
before update or delete on public.clinic_staff_management_history
for each row execute function graftvision_private.prevent_clinic_staff_history_mutation();

create function graftvision_private.enforce_controlled_invitation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.staff_management_controlled', true) <> 'on' then
    raise exception using errcode = '55000', message = 'INVITATION_CONTROLLED_MUTATION_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function graftvision_private.enforce_controlled_invitation_mutation()
  from public, anon, authenticated;

create trigger clinic_invitation_controlled_mutation
before insert or update or delete on public.clinic_invitation
for each row execute function graftvision_private.enforce_controlled_invitation_mutation();

create trigger clinic_invitation_role_controlled_mutation
before insert or update or delete on public.clinic_invitation_role
for each row execute function graftvision_private.enforce_controlled_invitation_mutation();

create or replace function graftvision_private.increment_clinic_membership_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.staff_management_controlled', true) = 'on' then
    return null;
  end if;

  update public.clinic_membership
  set authorization_version = authorization_version + 1,
      updated_at = timezone('utc', statement_timestamp())
  where id = coalesce(new.clinic_membership_id, old.clinic_membership_id);
  return null;
end;
$$;

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.create', 'clinic.inactivate', 'clinic.read',
    'clinic.reactivate', 'clinic.suspend', 'doctor.verification.expired',
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

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation',
    'clinic_membership', 'clinic_membership_role', 'doctor_verification',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system'
  );
$$;

create function graftvision_private.staff_actor_role(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'clinic',
    (select clinic_id from public.application_session where id = p_session_id),
    'ADMIN-PERM-003'
  ) then
    return null;
  end if;

  select case
    when bool_or(cmr.role_code = 'CLINIC_OWNER') then 'CLINIC_OWNER'
    when bool_or(cmr.role_code = 'CLINIC_ADMIN') then 'CLINIC_ADMIN'
    else null
  end into v_role
  from public.application_session s
  join public.clinic_membership m
    on m.clinic_id = s.clinic_id and m.platform_user_id = s.platform_user_id
  join public.clinic_membership_role cmr on cmr.clinic_membership_id = m.id
  where s.id = p_session_id
    and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';

  return v_role;
end;
$$;

revoke all on function graftvision_private.staff_actor_role(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.validate_managed_roles(
  p_actor_role text,
  p_role_codes text[]
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(cardinality(p_role_codes), 0) > 0
    and not ('PATIENT' = any(p_role_codes))
    and not exists (
      select 1 from unnest(p_role_codes) role_code
      where role_code not in (
        'CLINIC_OWNER', 'CLINIC_ADMIN', 'DOCTOR', 'CLINICAL_ASSISTANT',
        'PROCEDURE_TECHNICIAN', 'RECEPTION', 'REPORT_COORDINATOR',
        'PRESENTATION', 'REVIEWER'
      )
    )
    and (
      p_actor_role = 'CLINIC_OWNER'
      or (
        p_actor_role = 'CLINIC_ADMIN'
        and p_role_codes <@ array[
          'CLINICAL_ASSISTANT', 'PROCEDURE_TECHNICIAN', 'RECEPTION',
          'REPORT_COORDINATOR', 'PRESENTATION', 'REVIEWER'
        ]::text[]
      )
    );
$$;

revoke all on function graftvision_private.validate_managed_roles(text, text[])
  from public, anon, authenticated;

create function graftvision_private.write_staff_audit(
  p_actor_id uuid,
  p_clinic_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', p_clinic_id, p_actor_id, 'user', p_action,
    p_resource_type, p_resource_id, 'success', p_reason_code, 'database', p_metadata
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function graftvision_private.write_staff_audit(
  uuid, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated;

create function graftvision_private.create_clinic_invitation(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_normalized_email text,
  p_provider_reference_hash text,
  p_role_codes text[],
  p_expiry_days integer default 7
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_clinic_id uuid;
  v_invitation_id uuid;
  v_audit_id uuid;
  v_expired record;
begin
  v_actor_role := graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id);
  select clinic_id into v_clinic_id from public.application_session where id = p_session_id;
  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  if not graftvision_private.validate_managed_roles(v_actor_role, p_role_codes) then
    raise exception using errcode = '42501', message = 'ROLE_ASSIGNMENT_DENIED';
  end if;
  if not graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'clinic', v_clinic_id,
    case
      when p_role_codes && array['CLINIC_OWNER', 'CLINIC_ADMIN', 'DOCTOR']::text[]
        then 'ROLE-007'
      else 'ROLE-006'
    end
  ) then
    raise exception using errcode = '42501', message = 'ROLE_ASSIGNMENT_DENIED';
  end if;
  if p_normalized_email is null
    or p_normalized_email <> lower(btrim(p_normalized_email))
    or p_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(p_normalized_email) not between 3 and 254
    or p_provider_reference_hash !~ '^[a-f0-9]{64}$'
    or p_expiry_days <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION_INPUT';
  end if;

  perform set_config('graftvision.staff_management_controlled', 'on', true);
  for v_expired in
    update public.clinic_invitation
    set status = 'expired', updated_at = clock_timestamp()
    where clinic_id = v_clinic_id
      and normalized_email = p_normalized_email
      and status = 'pending'
      and expires_at <= clock_timestamp()
    returning *
  loop
    v_audit_id := graftvision_private.write_staff_audit(
      p_provider_identity_id, v_clinic_id, 'invitation.revoke',
      'clinic_invitation', v_expired.id, 'EXPIRED', '{}'::jsonb
    );
    insert into public.clinic_invitation_history (
      invitation_id, clinic_id, action, previous_status, new_status,
      actor_platform_user_id, audit_event_id
    ) values (
      v_expired.id, v_clinic_id, 'expired', 'pending', 'expired',
      p_provider_identity_id, v_audit_id
    );
  end loop;

  insert into public.clinic_invitation (
    clinic_id, normalized_email, provider_reference_hash, expires_at,
    created_by_platform_user_id
  ) values (
    v_clinic_id, p_normalized_email, p_provider_reference_hash,
    clock_timestamp() + make_interval(days => p_expiry_days), p_provider_identity_id
  ) returning id into v_invitation_id;

  insert into public.clinic_invitation_role (invitation_id, role_code)
  select v_invitation_id, distinct_role
  from (select distinct unnest(p_role_codes) distinct_role) roles;

  v_audit_id := graftvision_private.write_staff_audit(
    p_provider_identity_id, v_clinic_id, 'invitation.create',
    'clinic_invitation', v_invitation_id, 'STAFF_INVITED',
    jsonb_build_object('affected_count', cardinality(p_role_codes))
  );
  insert into public.clinic_invitation_history (
    invitation_id, clinic_id, action, previous_status, new_status,
    actor_platform_user_id, audit_event_id
  ) values (
    v_invitation_id, v_clinic_id, 'created', null, 'pending',
    p_provider_identity_id, v_audit_id
  );
  perform set_config('graftvision.staff_management_controlled', 'off', true);
  return v_invitation_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PENDING_INVITATION_EXISTS';
end;
$$;

revoke all on function graftvision_private.create_clinic_invitation(
  uuid, uuid, text, text, text[], integer
) from public, anon, authenticated;

create function graftvision_private.transition_clinic_invitation(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_invitation_id uuid,
  p_action text,
  p_provider_reference_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_invitation public.clinic_invitation%rowtype;
  v_audit_id uuid;
begin
  v_actor_role := graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id);
  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  select * into v_invitation from public.clinic_invitation
  where id = p_invitation_id
    and clinic_id = (select clinic_id from public.application_session where id = p_session_id)
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'INVITATION_NOT_AVAILABLE';
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= clock_timestamp() then
    raise exception using errcode = '22023', message = 'INVITATION_NOT_PENDING';
  end if;

  perform set_config('graftvision.staff_management_controlled', 'on', true);
  if p_action = 'resend' and p_provider_reference_hash ~ '^[a-f0-9]{64}$' then
    update public.clinic_invitation
    set provider_reference_hash = p_provider_reference_hash,
        expires_at = clock_timestamp() + interval '7 days',
        updated_at = clock_timestamp()
    where id = p_invitation_id;
    v_audit_id := graftvision_private.write_staff_audit(
      p_provider_identity_id, v_invitation.clinic_id, 'invitation.resend',
      'clinic_invitation', p_invitation_id, 'INVITATION_ROTATED', '{}'::jsonb
    );
    insert into public.clinic_invitation_history (
      invitation_id, clinic_id, action, previous_status, new_status,
      actor_platform_user_id, audit_event_id
    ) values (
      p_invitation_id, v_invitation.clinic_id, 'resent', 'pending', 'pending',
      p_provider_identity_id, v_audit_id
    );
  elsif p_action = 'revoke' and p_provider_reference_hash is null then
    update public.clinic_invitation
    set status = 'revoked', updated_at = clock_timestamp()
    where id = p_invitation_id;
    v_audit_id := graftvision_private.write_staff_audit(
      p_provider_identity_id, v_invitation.clinic_id, 'invitation.revoke',
      'clinic_invitation', p_invitation_id, 'INVITATION_REVOKED', '{}'::jsonb
    );
    insert into public.clinic_invitation_history (
      invitation_id, clinic_id, action, previous_status, new_status,
      actor_platform_user_id, audit_event_id
    ) values (
      p_invitation_id, v_invitation.clinic_id, 'revoked', 'pending', 'revoked',
      p_provider_identity_id, v_audit_id
    );
  else
    raise exception using errcode = '22023', message = 'INVALID_INVITATION_TRANSITION';
  end if;
  perform set_config('graftvision.staff_management_controlled', 'off', true);
  return true;
end;
$$;

revoke all on function graftvision_private.transition_clinic_invitation(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

create function graftvision_private.accept_clinic_invitation(
  p_invitation_id uuid,
  p_platform_user_id uuid,
  p_normalized_email text,
  p_provider_reference_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.clinic_invitation%rowtype;
  v_membership_id uuid;
  v_roles text[];
  v_audit_id uuid;
begin
  select * into v_invitation from public.clinic_invitation
  where id = p_invitation_id for update;
  if not found
    or v_invitation.normalized_email <> lower(btrim(p_normalized_email))
    or v_invitation.provider_reference_hash <> p_provider_reference_hash then
    raise exception using errcode = '42501', message = 'INVITATION_NOT_AVAILABLE';
  end if;
  if v_invitation.status = 'accepted'
    and v_invitation.accepted_platform_user_id = p_platform_user_id then
    select id into v_membership_id from public.clinic_membership
    where clinic_id = v_invitation.clinic_id and platform_user_id = p_platform_user_id;
    return v_membership_id;
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= clock_timestamp() then
    raise exception using errcode = '22023', message = 'INVITATION_NOT_PENDING';
  end if;
  if not exists (
    select 1 from public.platform_user
    where id = p_platform_user_id and status = 'active' and external_identity_id is not null
  ) or not exists (
    select 1 from public.clinic where id = v_invitation.clinic_id and status = 'active'
  ) then
    raise exception using errcode = '28000', message = 'INVITED_IDENTITY_REQUIRED';
  end if;

  select array_agg(role_code order by role_code) into v_roles
  from public.clinic_invitation_role where invitation_id = p_invitation_id;
  perform set_config('graftvision.staff_management_controlled', 'on', true);
  insert into public.clinic_membership (clinic_id, platform_user_id, membership_status)
  values (v_invitation.clinic_id, p_platform_user_id, 'active')
  on conflict (clinic_id, platform_user_id) do update
  set membership_status = 'active', updated_at = clock_timestamp()
  returning id into v_membership_id;

  delete from public.clinic_membership_role where clinic_membership_id = v_membership_id;
  insert into public.clinic_membership_role (clinic_membership_id, role_code)
  select v_membership_id, unnest(v_roles);
  update public.clinic_membership
  set authorization_version = authorization_version + 1, updated_at = clock_timestamp()
  where id = v_membership_id;
  update public.clinic_invitation
  set status = 'accepted', accepted_platform_user_id = p_platform_user_id,
      updated_at = clock_timestamp()
  where id = p_invitation_id;
  v_audit_id := graftvision_private.write_staff_audit(
    p_platform_user_id, v_invitation.clinic_id, 'invitation.accept',
    'clinic_invitation', p_invitation_id, 'INVITATION_ACCEPTED',
    jsonb_build_object('affected_count', cardinality(v_roles))
  );
  insert into public.clinic_invitation_history (
    invitation_id, clinic_id, action, previous_status, new_status,
    actor_platform_user_id, audit_event_id
  ) values (
    p_invitation_id, v_invitation.clinic_id, 'accepted', 'pending', 'accepted',
    p_platform_user_id, v_audit_id
  );
  insert into public.clinic_staff_management_history (
    clinic_id, clinic_membership_id, action, previous_roles, new_roles,
    previous_membership_status, new_membership_status,
    actor_platform_user_id, audit_event_id
  ) values (
    v_invitation.clinic_id, v_membership_id, 'reactivated', '{}', v_roles,
    'suspended', 'active', p_platform_user_id, v_audit_id
  );
  perform set_config('graftvision.staff_management_controlled', 'off', true);
  return v_membership_id;
end;
$$;

revoke all on function graftvision_private.accept_clinic_invitation(
  uuid, uuid, text, text
) from public, anon, authenticated;

create function graftvision_private.set_clinic_membership_roles(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_membership_id uuid,
  p_role_codes text[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_clinic_id uuid;
  v_previous_roles text[];
  v_audit_id uuid;
begin
  v_actor_role := graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id);
  select clinic_id into v_clinic_id from public.application_session where id = p_session_id;
  if v_actor_role is null
    or not graftvision_private.validate_managed_roles(v_actor_role, p_role_codes) then
    raise exception using errcode = '42501', message = 'ROLE_ASSIGNMENT_DENIED';
  end if;
  if not graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'clinic', v_clinic_id,
    case
      when p_role_codes && array['CLINIC_OWNER', 'CLINIC_ADMIN', 'DOCTOR']::text[]
        then 'ROLE-007'
      else 'ROLE-006'
    end
  ) then
    raise exception using errcode = '42501', message = 'ROLE_ASSIGNMENT_DENIED';
  end if;
  if not graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'ROLE-009'
  ) then
    raise exception using errcode = '42501', message = 'ROLE_REMOVAL_DENIED';
  end if;
  select coalesce(array_agg(cmr.role_code order by cmr.role_code), '{}')
  into v_previous_roles
  from public.clinic_membership m
  left join public.clinic_membership_role cmr on cmr.clinic_membership_id = m.id
  where m.id = p_membership_id and m.clinic_id = v_clinic_id
  group by m.id;
  if not found then
    raise exception using errcode = '42501', message = 'MEMBERSHIP_NOT_AVAILABLE';
  end if;
  if v_actor_role = 'CLINIC_ADMIN'
    and v_previous_roles && array['CLINIC_OWNER', 'CLINIC_ADMIN', 'DOCTOR']::text[] then
    raise exception using errcode = '42501', message = 'ROLE_REMOVAL_DENIED';
  end if;
  if 'CLINIC_OWNER' = any(v_previous_roles)
    and not ('CLINIC_OWNER' = any(p_role_codes))
    and (
      select count(*) from public.clinic_membership_role cmr
      join public.clinic_membership m on m.id = cmr.clinic_membership_id
      where m.clinic_id = v_clinic_id and m.membership_status = 'active'
        and cmr.role_code = 'CLINIC_OWNER'
    ) <= 1 then
    raise exception using errcode = '42501', message = 'LAST_CLINIC_OWNER_REQUIRED';
  end if;

  perform set_config('graftvision.staff_management_controlled', 'on', true);
  delete from public.clinic_membership_role where clinic_membership_id = p_membership_id;
  insert into public.clinic_membership_role (clinic_membership_id, role_code)
  select p_membership_id, distinct_role
  from (select distinct unnest(p_role_codes) distinct_role) roles;
  update public.clinic_membership
  set authorization_version = authorization_version + 1, updated_at = clock_timestamp()
  where id = p_membership_id;
  v_audit_id := graftvision_private.write_staff_audit(
    p_provider_identity_id, v_clinic_id, 'membership.role_assign',
    'clinic_membership', p_membership_id, 'ROLES_REPLACED',
    jsonb_build_object('affected_count', cardinality(p_role_codes))
  );
  insert into public.clinic_staff_management_history (
    clinic_id, clinic_membership_id, action, previous_roles, new_roles,
    previous_membership_status, new_membership_status,
    actor_platform_user_id, audit_event_id
  ) values (
    v_clinic_id, p_membership_id, 'roles_changed', v_previous_roles, p_role_codes,
    'active', 'active', p_provider_identity_id, v_audit_id
  );
  perform set_config('graftvision.staff_management_controlled', 'off', true);
  return true;
end;
$$;

revoke all on function graftvision_private.set_clinic_membership_roles(
  uuid, uuid, uuid, text[]
) from public, anon, authenticated;

create function graftvision_private.deactivate_clinic_staff(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_membership_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_clinic_id uuid;
  v_roles text[];
  v_audit_id uuid;
begin
  v_actor_role := graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id);
  select clinic_id into v_clinic_id from public.application_session where id = p_session_id;
  if v_actor_role is null or not graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'ROLE-009'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select array_agg(cmr.role_code order by cmr.role_code) into v_roles
  from public.clinic_membership m
  join public.clinic_membership_role cmr on cmr.clinic_membership_id = m.id
  where m.id = p_membership_id and m.clinic_id = v_clinic_id
  group by m.id;
  if not found
    or (v_actor_role = 'CLINIC_ADMIN' and v_roles && array['CLINIC_OWNER', 'CLINIC_ADMIN', 'DOCTOR']::text[])
    or ('CLINIC_OWNER' = any(v_roles) and (
      select count(*) from public.clinic_membership_role cmr
      join public.clinic_membership m on m.id = cmr.clinic_membership_id
      where m.clinic_id = v_clinic_id and m.membership_status = 'active'
        and cmr.role_code = 'CLINIC_OWNER'
    ) <= 1) then
    raise exception using errcode = '42501', message = 'MEMBERSHIP_DEACTIVATION_DENIED';
  end if;

  update public.clinic_membership
  set membership_status = 'suspended',
      authorization_version = authorization_version + 1,
      updated_at = clock_timestamp()
  where id = p_membership_id and membership_status = 'active';
  if not found then
    raise exception using errcode = '22023', message = 'MEMBERSHIP_NOT_ACTIVE';
  end if;
  v_audit_id := graftvision_private.write_staff_audit(
    p_provider_identity_id, v_clinic_id, 'membership.deactivate',
    'clinic_membership', p_membership_id, 'STAFF_DEACTIVATED', '{}'::jsonb
  );
  insert into public.clinic_staff_management_history (
    clinic_id, clinic_membership_id, action, previous_roles, new_roles,
    previous_membership_status, new_membership_status,
    actor_platform_user_id, audit_event_id
  ) values (
    v_clinic_id, p_membership_id, 'deactivated', v_roles, v_roles,
    'active', 'suspended', p_provider_identity_id, v_audit_id
  );
  return true;
end;
$$;

revoke all on function graftvision_private.deactivate_clinic_staff(
  uuid, uuid, uuid
) from public, anon, authenticated;

create function graftvision_private.list_clinic_staff(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (
  membership_id uuid,
  platform_user_id uuid,
  membership_status text,
  role_codes text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id) is null then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  return query
  select m.id, m.platform_user_id, m.membership_status,
    coalesce(array_agg(cmr.role_code order by cmr.role_code) filter (where cmr.role_code is not null), '{}')
  from public.clinic_membership m
  left join public.clinic_membership_role cmr on cmr.clinic_membership_id = m.id
  where m.clinic_id = (select s.clinic_id from public.application_session s where s.id = p_session_id)
  group by m.id, m.platform_user_id, m.membership_status
  order by m.created_at, m.id;
end;
$$;

revoke all on function graftvision_private.list_clinic_staff(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.list_pending_clinic_invitations(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (
  invitation_id uuid,
  normalized_email text,
  expires_at timestamptz,
  role_codes text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if graftvision_private.staff_actor_role(p_session_id, p_provider_identity_id) is null then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  return query
  select i.id, i.normalized_email, i.expires_at,
    array_agg(ir.role_code order by ir.role_code)
  from public.clinic_invitation i
  join public.clinic_invitation_role ir on ir.invitation_id = i.id
  where i.clinic_id = (select s.clinic_id from public.application_session s where s.id = p_session_id)
    and i.status = 'pending'
    and i.expires_at > clock_timestamp()
  group by i.id, i.normalized_email, i.expires_at
  order by i.created_at, i.id;
end;
$$;

revoke all on function graftvision_private.list_pending_clinic_invitations(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.bootstrap_first_clinic_owner(
  p_platform_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_id uuid,
  p_target_platform_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
  v_audit_id uuid;
begin
  if not graftvision_private.has_clinic_lifecycle_authority(
    p_platform_session_id, p_provider_identity_id
  ) or exists (
    select 1 from public.clinic_membership_role cmr
    join public.clinic_membership m on m.id = cmr.clinic_membership_id
    where m.clinic_id = p_clinic_id and cmr.role_code = 'CLINIC_OWNER'
  ) then
    raise exception using errcode = '42501', message = 'OWNER_BOOTSTRAP_DENIED';
  end if;
  if not exists (select 1 from public.clinic where id = p_clinic_id and status = 'active')
    or not exists (select 1 from public.platform_user where id = p_target_platform_user_id and status = 'active') then
    raise exception using errcode = '22023', message = 'OWNER_BOOTSTRAP_TARGET_INVALID';
  end if;
  perform set_config('graftvision.staff_management_controlled', 'on', true);
  insert into public.clinic_membership (clinic_id, platform_user_id, membership_status)
  values (p_clinic_id, p_target_platform_user_id, 'active')
  on conflict (clinic_id, platform_user_id) do update set membership_status = 'active'
  returning id into v_membership_id;
  insert into public.clinic_membership_role (clinic_membership_id, role_code)
  values (v_membership_id, 'CLINIC_OWNER')
  on conflict do nothing;
  update public.clinic_membership
  set authorization_version = authorization_version + 1, updated_at = clock_timestamp()
  where id = v_membership_id;
  v_audit_id := graftvision_private.write_staff_audit(
    p_provider_identity_id, p_clinic_id, 'membership.role_assign',
    'clinic_membership', v_membership_id, 'FIRST_OWNER_BOOTSTRAPPED',
    jsonb_build_object('affected_count', 1)
  );
  insert into public.clinic_staff_management_history (
    clinic_id, clinic_membership_id, action, previous_roles, new_roles,
    previous_membership_status, new_membership_status,
    actor_platform_user_id, audit_event_id
  ) values (
    p_clinic_id, v_membership_id, 'owner_bootstrapped', '{}', array['CLINIC_OWNER'],
    'active', 'active', p_provider_identity_id, v_audit_id
  );
  perform set_config('graftvision.staff_management_controlled', 'off', true);
  return v_membership_id;
end;
$$;

revoke all on function graftvision_private.bootstrap_first_clinic_owner(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
