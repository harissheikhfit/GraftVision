-- GraftVision migration
-- Task: CLINIC-005
-- Purpose: Add a database-authoritative clinic onboarding checklist and readiness gate.
-- Created UTC: 20260728000005
-- graftvision:dangerous-sql-approved task=CLINIC-005
-- graftvision:dangerous-sql-reason Reviewed typed attestations, derived readiness, immutable history, controlled procedures, and audit actions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create table public.clinic_onboarding_readiness (
  clinic_id uuid primary key references public.clinic(id) on update restrict on delete restrict,
  state text not null default 'not_ready'
    check (state in ('not_ready', 'ready', 'reopened')),
  ever_ready boolean not null default false,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_by_platform_user_id uuid
    references public.platform_user(id) on update restrict on delete restrict
);

create table public.clinic_onboarding_attestation (
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  attestation_code text not null
    check (attestation_code in ('PROTOCOL_TEMPLATE_READY', 'SECURITY_READY')),
  status text not null check (status in ('attested', 'withdrawn')),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  revision integer not null check (revision >= 1),
  primary key (clinic_id, attestation_code),
  check (expires_at is null or expires_at > occurred_at)
);

create table public.clinic_onboarding_attestation_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  attestation_code text not null
    check (attestation_code in ('PROTOCOL_TEMPLATE_READY', 'SECURITY_READY')),
  previous_status text check (previous_status is null or previous_status in ('attested', 'withdrawn')),
  new_status text not null check (new_status in ('attested', 'withdrawn')),
  previous_revision integer not null check (previous_revision >= 0),
  new_revision integer not null check (new_revision = previous_revision + 1),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz
);

create table public.clinic_onboarding_readiness_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  previous_state text not null check (previous_state in ('not_ready', 'ready', 'reopened')),
  new_state text not null check (new_state in ('not_ready', 'ready', 'reopened')),
  previous_revision integer not null,
  new_revision integer not null check (new_revision = previous_revision + 1),
  reason_code text not null
    check (reason_code in ('ALL_BLOCKERS_PASSED', 'BLOCKER_FAILED', 'ATTESTATION_CHANGED')),
  actor_platform_user_id uuid
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  check (previous_state <> new_state)
);

create index clinic_onboarding_attestation_history_idx
  on public.clinic_onboarding_attestation_history (clinic_id, occurred_at desc);
create index clinic_onboarding_readiness_history_idx
  on public.clinic_onboarding_readiness_history (clinic_id, new_revision desc);

alter table public.clinic_onboarding_readiness enable row level security;
alter table public.clinic_onboarding_readiness force row level security;
alter table public.clinic_onboarding_attestation enable row level security;
alter table public.clinic_onboarding_attestation force row level security;
alter table public.clinic_onboarding_attestation_history enable row level security;
alter table public.clinic_onboarding_attestation_history force row level security;
alter table public.clinic_onboarding_readiness_history enable row level security;
alter table public.clinic_onboarding_readiness_history force row level security;

revoke all on table public.clinic_onboarding_readiness from public, anon, authenticated;
revoke all on table public.clinic_onboarding_attestation from public, anon, authenticated;
revoke all on table public.clinic_onboarding_attestation_history from public, anon, authenticated;
revoke all on table public.clinic_onboarding_readiness_history from public, anon, authenticated;

create trigger clinic_onboarding_attestation_history_immutable
before update or delete on public.clinic_onboarding_attestation_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create trigger clinic_onboarding_readiness_history_immutable
before update or delete on public.clinic_onboarding_readiness_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create function graftvision_private.enforce_controlled_clinic_onboarding_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.clinic_onboarding_controlled', true) <> 'on' then
    raise exception using errcode = '55000', message = 'CLINIC_ONBOARDING_CONTROLLED_MUTATION_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function graftvision_private.enforce_controlled_clinic_onboarding_mutation()
  from public, anon, authenticated;

create trigger clinic_onboarding_readiness_controlled
before insert or update or delete on public.clinic_onboarding_readiness
for each row execute function graftvision_private.enforce_controlled_clinic_onboarding_mutation();

create trigger clinic_onboarding_attestation_controlled
before insert or update or delete on public.clinic_onboarding_attestation
for each row execute function graftvision_private.enforce_controlled_clinic_onboarding_mutation();

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.branding_conflict', 'clinic.branding_update',
    'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.onboarding_attest',
    'clinic.onboarding_blocked', 'clinic.onboarding_ready', 'clinic.onboarding_reopened',
    'clinic.read', 'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
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

create function graftvision_private.has_clinic_onboarding_authority(
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

revoke all on function graftvision_private.has_clinic_onboarding_authority(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.clinic_onboarding_checks(p_clinic_id uuid)
returns table (
  clinic_active boolean,
  clinic_profile boolean,
  clinic_owner boolean,
  verified_doctor boolean,
  timezone_valid boolean,
  security_ready boolean,
  protocol_template_ready boolean,
  branding_present boolean,
  staff_configured boolean,
  all_blockers_pass boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with checks as (
    select
      c.status = 'active' as clinic_active,
      length(btrim(c.display_name)) between 1 and 160
        and c.clinic_code ~ '^[a-z][a-z0-9-]{2,62}$' as clinic_profile,
      exists (
        select 1
        from public.clinic_membership m
        join public.platform_user u on u.id = m.platform_user_id and u.status = 'active'
        join public.clinic_membership_role mr
          on mr.clinic_membership_id = m.id and mr.role_code = 'CLINIC_OWNER'
        where m.clinic_id = c.id and m.membership_status = 'active'
      ) as clinic_owner,
      exists (
        select 1
        from public.clinic_membership m
        join public.platform_user u on u.id = m.platform_user_id and u.status = 'active'
        join public.clinic_membership_role mr
          on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
        join public.doctor_verification dv
          on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
        where m.clinic_id = c.id
          and m.membership_status = 'active'
          and dv.status = 'verified'
          and dv.expires_at > clock_timestamp()
      ) as verified_doctor,
      graftvision_private.is_valid_iana_timezone(c.timezone) as timezone_valid,
      exists (
        select 1 from public.clinic_onboarding_attestation a
        where a.clinic_id = c.id
          and a.attestation_code = 'SECURITY_READY'
          and a.status = 'attested'
          and (a.expires_at is null or a.expires_at > clock_timestamp())
      ) as security_ready,
      exists (
        select 1 from public.clinic_onboarding_attestation a
        where a.clinic_id = c.id
          and a.attestation_code = 'PROTOCOL_TEMPLATE_READY'
          and a.status = 'attested'
          and (a.expires_at is null or a.expires_at > clock_timestamp())
      ) as protocol_template_ready,
      exists (
        select 1 from public.clinic_branding b where b.clinic_id = c.id
      ) as branding_present,
      exists (
        select 1 from public.clinic_membership m
        where m.clinic_id = c.id and m.membership_status = 'active'
      ) as staff_configured
    from public.clinic c
    where c.id = p_clinic_id
  )
  select *,
    clinic_active and clinic_profile and clinic_owner and verified_doctor
      and timezone_valid and security_ready and protocol_template_ready
  from checks;
$$;

revoke all on function graftvision_private.clinic_onboarding_checks(uuid)
  from public, anon, authenticated;

create function graftvision_private.is_clinic_ready(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select all_blockers_pass
    from graftvision_private.clinic_onboarding_checks(p_clinic_id)), false);
$$;

revoke all on function graftvision_private.is_clinic_ready(uuid)
  from public, anon, authenticated;

create function graftvision_private.sync_clinic_onboarding_readiness(
  p_clinic_id uuid,
  p_actor_platform_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.clinic_onboarding_readiness%rowtype;
  v_pass boolean;
  v_next_state text;
  v_action text;
begin
  perform set_config('graftvision.clinic_onboarding_controlled', 'on', true);
  insert into public.clinic_onboarding_readiness (clinic_id)
  values (p_clinic_id) on conflict (clinic_id) do nothing;
  perform set_config('graftvision.clinic_onboarding_controlled', 'off', true);

  select * into v_current from public.clinic_onboarding_readiness
  where clinic_id = p_clinic_id for update;
  select all_blockers_pass into v_pass
  from graftvision_private.clinic_onboarding_checks(p_clinic_id);
  v_pass := coalesce(v_pass, false);
  v_next_state := case
    when v_pass then 'ready'
    when v_current.ever_ready then 'reopened'
    else 'not_ready'
  end;

  if v_current.state = v_next_state then
    return v_next_state;
  end if;

  perform set_config('graftvision.clinic_onboarding_controlled', 'on', true);
  update public.clinic_onboarding_readiness
  set state = v_next_state,
      ever_ready = ever_ready or v_next_state = 'ready',
      revision = revision + 1,
      updated_at = timezone('utc', statement_timestamp()),
      updated_by_platform_user_id = p_actor_platform_user_id
  where clinic_id = p_clinic_id;
  perform set_config('graftvision.clinic_onboarding_controlled', 'off', true);

  insert into public.clinic_onboarding_readiness_history (
    clinic_id, previous_state, new_state, previous_revision, new_revision,
    reason_code, actor_platform_user_id
  ) values (
    p_clinic_id, v_current.state, v_next_state, v_current.revision, v_current.revision + 1,
    case when v_next_state = 'ready' then 'ALL_BLOCKERS_PASSED' else 'BLOCKER_FAILED' end,
    p_actor_platform_user_id
  );

  v_action := case
    when v_next_state = 'ready' then 'clinic.onboarding_ready'
    else 'clinic.onboarding_reopened'
  end;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', p_clinic_id, p_actor_platform_user_id,
    case when p_actor_platform_user_id is null then 'system' else 'user' end,
    v_action, 'clinic', p_clinic_id, 'success',
    case when v_next_state = 'ready' then 'ALL_BLOCKERS_PASSED' else 'BLOCKER_FAILED' end,
    'database', jsonb_build_object('previous_status', v_current.state, 'new_status', v_next_state)
  );
  return v_next_state;
end;
$$;

revoke all on function graftvision_private.sync_clinic_onboarding_readiness(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.read_clinic_onboarding(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (
  clinic_id uuid,
  readiness_state text,
  readiness_revision integer,
  checklist jsonb,
  security_status text,
  security_revision integer,
  security_expires_at timestamptz,
  protocol_status text,
  protocol_revision integer,
  protocol_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
begin
  if not graftvision_private.has_clinic_onboarding_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s
  where s.id = p_session_id;
  perform graftvision_private.sync_clinic_onboarding_readiness(
    v_clinic_id, p_provider_identity_id
  );
  return query
  select r.clinic_id, r.state, r.revision,
    jsonb_build_object(
      'clinic_active', c.clinic_active,
      'clinic_profile', c.clinic_profile,
      'clinic_owner', c.clinic_owner,
      'verified_doctor', c.verified_doctor,
      'timezone_valid', c.timezone_valid,
      'security_ready', c.security_ready,
      'protocol_template_ready', c.protocol_template_ready,
      'branding_present', c.branding_present,
      'staff_configured', c.staff_configured,
      'all_blockers_pass', c.all_blockers_pass
    ),
    coalesce(sa.status, 'missing'), coalesce(sa.revision, 0), sa.expires_at,
    coalesce(pa.status, 'missing'), coalesce(pa.revision, 0), pa.expires_at
  from public.clinic_onboarding_readiness r
  cross join graftvision_private.clinic_onboarding_checks(v_clinic_id) c
  left join public.clinic_onboarding_attestation sa
    on sa.clinic_id = r.clinic_id and sa.attestation_code = 'SECURITY_READY'
  left join public.clinic_onboarding_attestation pa
    on pa.clinic_id = r.clinic_id and pa.attestation_code = 'PROTOCOL_TEMPLATE_READY'
  where r.clinic_id = v_clinic_id;
end;
$$;

revoke all on function graftvision_private.read_clinic_onboarding(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.attest_clinic_onboarding(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_attestation_code text,
  p_status text,
  p_expected_revision integer,
  p_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_existing public.clinic_onboarding_attestation%rowtype;
  v_previous_revision integer;
  v_state text;
begin
  if not graftvision_private.has_clinic_onboarding_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_attestation_code not in ('PROTOCOL_TEMPLATE_READY', 'SECURITY_READY')
    or p_status not in ('attested', 'withdrawn')
    or p_expected_revision < 0
    or (p_expires_at is not null and p_expires_at <= clock_timestamp()) then
    raise exception using errcode = '22023', message = 'INVALID_ONBOARDING_ATTESTATION';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s
  where s.id = p_session_id;
  select * into v_existing from public.clinic_onboarding_attestation
  where clinic_id = v_clinic_id and attestation_code = p_attestation_code
  for update;
  v_previous_revision := coalesce(v_existing.revision, 0);
  if v_previous_revision <> p_expected_revision then
    return 'conflict';
  end if;

  perform set_config('graftvision.clinic_onboarding_controlled', 'on', true);
  insert into public.clinic_onboarding_attestation (
    clinic_id, attestation_code, status, actor_platform_user_id,
    occurred_at, expires_at, revision
  ) values (
    v_clinic_id, p_attestation_code, p_status, p_provider_identity_id,
    clock_timestamp(), case when p_status = 'attested' then p_expires_at else null end, 1
  )
  on conflict (clinic_id, attestation_code) do update
  set status = excluded.status,
      actor_platform_user_id = excluded.actor_platform_user_id,
      occurred_at = excluded.occurred_at,
      expires_at = excluded.expires_at,
      revision = public.clinic_onboarding_attestation.revision + 1;
  perform set_config('graftvision.clinic_onboarding_controlled', 'off', true);

  insert into public.clinic_onboarding_attestation_history (
    clinic_id, attestation_code, previous_status, new_status,
    previous_revision, new_revision, actor_platform_user_id, expires_at
  ) values (
    v_clinic_id, p_attestation_code, v_existing.status, p_status,
    v_previous_revision, v_previous_revision + 1, p_provider_identity_id,
    case when p_status = 'attested' then p_expires_at else null end
  );
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.onboarding_attest',
    'clinic', v_clinic_id, 'success', p_attestation_code, 'database',
    jsonb_build_object('new_status', p_status)
  );
  v_state := graftvision_private.sync_clinic_onboarding_readiness(
    v_clinic_id, p_provider_identity_id
  );
  if v_state <> 'ready' then
    insert into public.audit_event (
      audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
      resource_type, resource_id, outcome, reason_code, source_application, metadata
    ) values (
      'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.onboarding_blocked',
      'clinic', v_clinic_id, 'denied', 'BLOCKER_FAILED', 'database', '{}'::jsonb
    );
  end if;
  return 'updated';
end;
$$;

revoke all on function graftvision_private.attest_clinic_onboarding(
  uuid, uuid, text, text, integer, timestamptz
) from public, anon, authenticated;

create function graftvision_private.create_clinic_onboarding_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('graftvision.clinic_onboarding_controlled', 'on', true);
  insert into public.clinic_onboarding_readiness (clinic_id) values (new.id);
  perform set_config('graftvision.clinic_onboarding_controlled', 'off', true);
  return new;
end;
$$;

revoke all on function graftvision_private.create_clinic_onboarding_readiness()
  from public, anon, authenticated;

select set_config('graftvision.clinic_onboarding_controlled', 'on', true);
insert into public.clinic_onboarding_readiness (clinic_id)
select id from public.clinic on conflict (clinic_id) do nothing;
select set_config('graftvision.clinic_onboarding_controlled', 'off', true);

create trigger clinic_create_onboarding_readiness
after insert on public.clinic
for each row execute function graftvision_private.create_clinic_onboarding_readiness();
