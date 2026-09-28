-- GraftVision migration
-- Task: APPROVAL-001
-- Purpose: Add clinic-specific Doctor verification state and a database-authoritative Doctor predicate.
-- Created UTC: 20260727000005
-- Compatibility: Additive only; the 13-role and 58-permission catalogues are unchanged.
-- Security: State transitions derive actor and clinic from trusted context and require a valid clinic session.
-- graftvision:dangerous-sql-approved task=APPROVAL-001
-- graftvision:dangerous-sql-reason Reviewed controlled current-state, evidence, and authorization-version updates.
-- graftvision:corrective-plan Forward-fix the additive objects; restore from the pre-migration snapshot if application fails.

create table public.doctor_verification (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  platform_user_id uuid not null,
  status text not null
    check (status in ('pending', 'verified', 'rejected', 'revoked', 'expired')),
  verified_at timestamptz,
  expires_at timestamptz,
  current_history_id uuid,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint doctor_verification_clinic_fk
    foreign key (clinic_id) references public.clinic (id)
    on update restrict on delete restrict,
  constraint doctor_verification_user_fk
    foreign key (platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict,
  constraint doctor_verification_clinic_user_unique
    unique (clinic_id, platform_user_id),
  constraint doctor_verification_verified_state_check check (
    (
      status = 'verified'
      and verified_at is not null
      and expires_at is not null
      and expires_at > verified_at
    )
    or (
      status <> 'verified'
      and verified_at is null
      and expires_at is null
    )
  )
);

create table public.doctor_verification_evidence (
  doctor_verification_id uuid primary key,
  evidence_type text not null
    check (evidence_type in ('professional_registration', 'clinic_credentialing', 'other_reviewed')),
  issuing_authority text not null
    check (length(btrim(issuing_authority)) between 1 and 160),
  reference_identifier text not null
    check (length(btrim(reference_identifier)) between 1 and 160),
  internal_note text
    check (internal_note is null or length(btrim(internal_note)) between 1 and 280),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint doctor_verification_evidence_verification_fk
    foreign key (doctor_verification_id) references public.doctor_verification (id)
    on update restrict on delete restrict
);

comment on table public.doctor_verification_evidence is
  'Restricted verification metadata. Excluded from routine projections and audit metadata; raw credential documents are prohibited.';

create table public.doctor_verification_history (
  id uuid primary key default gen_random_uuid(),
  doctor_verification_id uuid not null,
  clinic_id uuid not null,
  platform_user_id uuid not null,
  actor_platform_user_id uuid not null,
  previous_status text,
  new_status text not null
    check (new_status in ('pending', 'verified', 'rejected', 'revoked', 'expired')),
  reason_code text not null
    check (reason_code in (
      'INITIAL_REVIEW',
      'VERIFICATION_APPROVED',
      'VERIFICATION_REJECTED',
      'VERIFICATION_REVOKED',
      'VERIFICATION_EXPIRED',
      'REVERIFICATION_REQUIRED'
    )),
  verified_at timestamptz,
  expires_at timestamptz,
  occurred_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint doctor_verification_history_verification_fk
    foreign key (doctor_verification_id) references public.doctor_verification (id)
    on update restrict on delete restrict,
  constraint doctor_verification_history_clinic_fk
    foreign key (clinic_id) references public.clinic (id)
    on update restrict on delete restrict,
  constraint doctor_verification_history_user_fk
    foreign key (platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict,
  constraint doctor_verification_history_actor_fk
    foreign key (actor_platform_user_id) references public.platform_user (id)
    on update restrict on delete restrict
);

alter table public.doctor_verification
  add constraint doctor_verification_current_history_fk
  foreign key (current_history_id) references public.doctor_verification_history (id)
  on update restrict on delete restrict
  deferrable initially deferred;

create index doctor_verification_history_verification_time_idx
  on public.doctor_verification_history (doctor_verification_id, occurred_at desc);

create function graftvision_private.guard_doctor_verification_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.doctor_verification_transition', true) <> 'allowed' then
    raise exception using errcode = '55000', message = 'DOCTOR_VERIFICATION_CONTROLLED_TRANSITION_REQUIRED';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function graftvision_private.prevent_doctor_verification_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'DOCTOR_VERIFICATION_HISTORY_IMMUTABLE';
end;
$$;

create trigger doctor_verification_controlled_state
before insert or update or delete on public.doctor_verification
for each row execute function graftvision_private.guard_doctor_verification_state();

create trigger doctor_verification_evidence_controlled_state
before insert or update or delete on public.doctor_verification_evidence
for each row execute function graftvision_private.guard_doctor_verification_state();

create trigger doctor_verification_history_controlled_insert
before insert on public.doctor_verification_history
for each row execute function graftvision_private.guard_doctor_verification_state();

create trigger doctor_verification_history_immutable
before update or delete on public.doctor_verification_history
for each row execute function graftvision_private.prevent_doctor_verification_history_mutation();

revoke all on function graftvision_private.guard_doctor_verification_state()
  from public, anon, authenticated;
revoke all on function graftvision_private.prevent_doctor_verification_history_mutation()
  from public, anon, authenticated;

alter table public.doctor_verification enable row level security;
alter table public.doctor_verification force row level security;
alter table public.doctor_verification_evidence enable row level security;
alter table public.doctor_verification_evidence force row level security;
alter table public.doctor_verification_history enable row level security;
alter table public.doctor_verification_history force row level security;

revoke all on table public.doctor_verification from public, anon, authenticated;
revoke all on table public.doctor_verification_evidence from public, anon, authenticated;
revoke all on table public.doctor_verification_history from public, anon, authenticated;

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
    'doctor_verification',
    'platform_user',
    'platform_user_role',
    'storage_object_key',
    'system'
  );
$$;

create function graftvision_private.transition_doctor_verification(
  p_session_id uuid,
  p_target_platform_user_id uuid,
  p_new_status text,
  p_reason_code text,
  p_expires_at timestamptz,
  p_evidence_type text,
  p_issuing_authority text,
  p_reference_identifier text,
  p_internal_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
  v_clinic_id uuid := graftvision_private.current_clinic_id();
  v_session public.application_session%rowtype;
  v_membership_id uuid;
  v_verification public.doctor_verification%rowtype;
  v_verification_id uuid;
  v_history_id uuid;
  v_required_permission text;
  v_verification_exists boolean := false;
  v_old_effective boolean := false;
  v_new_effective boolean := false;
  v_new_verified_at timestamptz;
  v_audit_action text;
  v_new_version integer;
begin
  if v_actor_id is null or v_clinic_id is null then
    raise exception using errcode = '28000', message = 'TRUSTED_CLINIC_CONTEXT_REQUIRED';
  end if;

  if p_target_platform_user_id = v_actor_id then
    raise exception using errcode = '42501', message = 'SELF_VERIFICATION_DENIED';
  end if;

  if p_new_status not in ('pending', 'verified', 'rejected', 'revoked', 'expired')
    or p_reason_code not in (
      'INITIAL_REVIEW',
      'VERIFICATION_APPROVED',
      'VERIFICATION_REJECTED',
      'VERIFICATION_REVOKED',
      'VERIFICATION_EXPIRED',
      'REVERIFICATION_REQUIRED'
    ) then
    raise exception using errcode = '22023', message = 'INVALID_VERIFICATION_TRANSITION';
  end if;

  if not graftvision_private.validate_application_session(p_session_id) then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;

  select * into strict v_session
  from public.application_session
  where id = p_session_id
    and platform_user_id = v_actor_id
    and authority_scope = 'clinic'
    and clinic_id = v_clinic_id;

  v_required_permission := case
    when p_new_status in ('revoked', 'expired') then 'ROLE-009'
    else 'ROLE-007'
  end;

  if not graftvision_private.has_application_session_permission(
    p_session_id,
    v_actor_id,
    'clinic',
    v_clinic_id,
    v_required_permission
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  select m.id into v_membership_id
  from public.clinic_membership m
  join public.clinic c on c.id = m.clinic_id
  join public.platform_user u on u.id = m.platform_user_id
  where m.clinic_id = v_clinic_id
    and m.platform_user_id = p_target_platform_user_id
    and m.membership_status = 'active'
    and c.status = 'active'
    and u.status = 'active'
    and exists (
      select 1
      from public.clinic_membership_role cmr
      where cmr.clinic_membership_id = m.id
        and cmr.role_code = 'DOCTOR'
    )
  for update of m;

  if v_membership_id is null then
    raise exception using errcode = '42501', message = 'ACTIVE_DOCTOR_ROLE_REQUIRED';
  end if;

  select * into v_verification
  from public.doctor_verification
  where clinic_id = v_clinic_id
    and platform_user_id = p_target_platform_user_id
  for update;

  v_verification_exists := found;

  if v_verification_exists then
    v_verification_id := v_verification.id;
    v_old_effective :=
      v_verification.status = 'verified'
      and v_verification.expires_at > clock_timestamp();
  else
    if p_new_status <> 'pending' then
      raise exception using errcode = '22023', message = 'INITIAL_STATUS_MUST_BE_PENDING';
    end if;
    v_verification_id := gen_random_uuid();
  end if;

  if p_new_status = 'pending' then
    if v_verification_exists and not (
      v_verification.status in ('rejected', 'revoked', 'expired')
      or (
        v_verification.status = 'verified'
        and v_verification.expires_at <= clock_timestamp()
      )
    ) then
      raise exception using errcode = '22023', message = 'INVALID_PENDING_TRANSITION';
    end if;
    if p_reason_code not in ('INITIAL_REVIEW', 'REVERIFICATION_REQUIRED') then
      raise exception using errcode = '22023', message = 'INVALID_PENDING_REASON';
    end if;
  elsif p_new_status in ('verified', 'rejected') then
    if not v_verification_exists or v_verification.status <> 'pending' then
      raise exception using errcode = '22023', message = 'VERIFICATION_REVIEW_REQUIRED';
    end if;
  elsif p_new_status = 'revoked' then
    if not v_verification_exists or v_verification.status <> 'verified'
      or v_verification.expires_at <= clock_timestamp() then
      raise exception using errcode = '22023', message = 'ACTIVE_VERIFICATION_REQUIRED';
    end if;
  elsif p_new_status = 'expired' then
    if not v_verification_exists or v_verification.status <> 'verified'
      or v_verification.expires_at > clock_timestamp() then
      raise exception using errcode = '22023', message = 'VERIFICATION_NOT_EXPIRED';
    end if;
  end if;

  if p_new_status = 'verified' then
    if p_expires_at is null or p_expires_at <= clock_timestamp()
      or p_evidence_type is null
      or p_issuing_authority is null
      or p_reference_identifier is null then
      raise exception using errcode = '22023', message = 'VERIFICATION_EVIDENCE_REQUIRED';
    end if;
    v_new_verified_at := clock_timestamp();
  elsif p_expires_at is not null then
    raise exception using errcode = '22023', message = 'EXPIRY_ONLY_ALLOWED_FOR_VERIFIED';
  end if;

  perform set_config('graftvision.doctor_verification_transition', 'allowed', true);

  if not v_verification_exists then
    insert into public.doctor_verification (
      id, clinic_id, platform_user_id, status
    ) values (
      v_verification_id, v_clinic_id, p_target_platform_user_id, p_new_status
    );
  else
    update public.doctor_verification
    set status = p_new_status,
        verified_at = v_new_verified_at,
        expires_at = p_expires_at,
        updated_at = timezone('utc', statement_timestamp())
    where id = v_verification_id;
  end if;

  if p_new_status = 'verified' then
    insert into public.doctor_verification_evidence (
      doctor_verification_id,
      evidence_type,
      issuing_authority,
      reference_identifier,
      internal_note
    ) values (
      v_verification_id,
      p_evidence_type,
      btrim(p_issuing_authority),
      btrim(p_reference_identifier),
      nullif(btrim(p_internal_note), '')
    )
    on conflict (doctor_verification_id) do update
    set evidence_type = excluded.evidence_type,
        issuing_authority = excluded.issuing_authority,
        reference_identifier = excluded.reference_identifier,
        internal_note = excluded.internal_note,
        updated_at = timezone('utc', statement_timestamp());
  end if;

  insert into public.doctor_verification_history (
    doctor_verification_id,
    clinic_id,
    platform_user_id,
    actor_platform_user_id,
    previous_status,
    new_status,
    reason_code,
    verified_at,
    expires_at
  ) values (
    v_verification_id,
    v_clinic_id,
    p_target_platform_user_id,
    v_actor_id,
    case when v_verification.id is null then null else v_verification.status end,
    p_new_status,
    p_reason_code,
    v_new_verified_at,
    p_expires_at
  )
  returning id into v_history_id;

  update public.doctor_verification
  set current_history_id = v_history_id
  where id = v_verification_id;

  v_new_effective :=
    p_new_status = 'verified'
    and p_expires_at > clock_timestamp();

  if v_old_effective is distinct from v_new_effective then
    update public.clinic_membership
    set authorization_version = authorization_version + 1,
        updated_at = timezone('utc', statement_timestamp())
    where id = v_membership_id
    returning authorization_version into v_new_version;
  end if;

  v_audit_action := 'doctor.verification.' || p_new_status;

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
  ) values (
    'clinic',
    v_clinic_id,
    v_actor_id,
    'user',
    v_audit_action,
    'doctor_verification',
    v_verification_id,
    'success',
    p_reason_code,
    'database',
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', case when v_verification.id is null then null else v_verification.status end,
      'new_status', p_new_status
    ))
  );

  perform set_config('graftvision.doctor_verification_transition', 'denied', true);

  return v_verification_id;
end;
$$;

revoke all on function graftvision_private.transition_doctor_verification(
  uuid, uuid, text, text, timestamptz, text, text, text, text
) from public, anon, authenticated;

create function graftvision_private.has_doctor_authority(
  p_session_id uuid,
  p_required_permission text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := graftvision_private.current_platform_user_id();
  v_clinic_id uuid := graftvision_private.current_clinic_id();
begin
  if v_actor_id is null or v_clinic_id is null then
    return false;
  end if;

  if not graftvision_private.has_application_session_permission(
    p_session_id,
    v_actor_id,
    'clinic',
    v_clinic_id,
    p_required_permission
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.application_session s
    join public.platform_user u on u.id = s.platform_user_id
    join public.clinic_membership m
      on m.platform_user_id = u.id
      and m.clinic_id = s.clinic_id
    join public.clinic c on c.id = m.clinic_id
    join public.clinic_membership_role cmr
      on cmr.clinic_membership_id = m.id
      and cmr.role_code = 'DOCTOR'
    join public.doctor_verification dv
      on dv.clinic_id = m.clinic_id
      and dv.platform_user_id = m.platform_user_id
    where s.id = p_session_id
      and s.platform_user_id = v_actor_id
      and s.authority_scope = 'clinic'
      and s.clinic_id = v_clinic_id
      and u.status = 'active'
      and c.status = 'active'
      and m.membership_status = 'active'
      and dv.status = 'verified'
      and dv.expires_at > clock_timestamp()
  );
end;
$$;

revoke all on function graftvision_private.has_doctor_authority(uuid, text)
  from public, anon, authenticated;
