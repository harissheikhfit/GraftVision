-- GraftVision migration
-- Task: PATIENT-001
-- Purpose: Add the tenant-scoped patient root, deterministic clinic numbering, idempotency, and history.
-- Created UTC: 20260728000006
-- Compatibility: Additive only; the 13-role and 58-permission catalogues remain unchanged.
-- Privacy: Synthetic root data only. Real-patient use remains blocked pending privacy/legal approval.
-- graftvision:dangerous-sql-approved task=PATIENT-001
-- graftvision:dangerous-sql-reason Reviewed controlled patient creation/status, numbering, idempotency, history, RLS, and audit actions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create table public.clinic_patient_counter (
  clinic_id uuid primary key references public.clinic(id) on update restrict on delete restrict,
  last_value integer not null default 0 check (last_value between 0 and 999999),
  updated_at timestamptz not null default timezone('utc', statement_timestamp())
);

create table public.patient (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  patient_number text not null check (patient_number ~ '^GV-[0-9]{6}$'),
  status text not null check (status in ('active', 'inactive')),
  revision integer not null default 1 check (revision >= 1),
  provenance_code text not null check (provenance_code = 'MANUAL_REGISTRATION'),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  created_by uuid not null references public.platform_user(id) on update restrict on delete restrict,
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_by uuid not null references public.platform_user(id) on update restrict on delete restrict,
  unique (clinic_id, patient_number)
);

alter table public.patient
  add constraint patient_clinic_id_id_unique unique (clinic_id, id);

create table public.patient_status_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  clinic_id uuid not null,
  previous_status text check (previous_status is null or previous_status in ('active', 'inactive')),
  new_status text not null check (new_status in ('active', 'inactive')),
  action_code text not null check (action_code in ('created', 'status_changed')),
  previous_revision integer not null check (previous_revision >= 0),
  new_revision integer not null check (new_revision = previous_revision + 1),
  provenance_code text not null check (provenance_code = 'MANUAL_REGISTRATION'),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint patient_status_history_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict
);

create table public.patient_creation_idempotency (
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  request_family text not null check (request_family = 'patient.create'),
  request_key_hash bytea not null check (octet_length(request_key_hash) = 32),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  patient_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_family, request_key_hash),
  constraint patient_creation_idempotency_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict
);

create index patient_clinic_status_created_idx
  on public.patient (clinic_id, status, created_at desc, id);
create index patient_status_history_patient_time_idx
  on public.patient_status_history (clinic_id, patient_id, occurred_at desc);

alter table public.clinic_patient_counter enable row level security;
alter table public.clinic_patient_counter force row level security;
alter table public.patient enable row level security;
alter table public.patient force row level security;
alter table public.patient_status_history enable row level security;
alter table public.patient_status_history force row level security;
alter table public.patient_creation_idempotency enable row level security;
alter table public.patient_creation_idempotency force row level security;

revoke all on table public.clinic_patient_counter from public, anon, authenticated;
revoke all on table public.patient from public, anon, authenticated;
revoke all on table public.patient_status_history from public, anon, authenticated;
revoke all on table public.patient_creation_idempotency from public, anon, authenticated;

create function graftvision_private.enforce_controlled_patient_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.patient_controlled', true) <> 'on' then
    raise exception using errcode = '55000', message = 'PATIENT_CONTROLLED_MUTATION_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function graftvision_private.enforce_controlled_patient_mutation()
  from public, anon, authenticated;

create trigger clinic_patient_counter_controlled
before insert or update or delete on public.clinic_patient_counter
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_controlled
before insert or update or delete on public.patient
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_status_history_controlled
before insert on public.patient_status_history
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_status_history_immutable
before update or delete on public.patient_status_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();
create trigger patient_creation_idempotency_controlled
before insert or update or delete on public.patient_creation_idempotency
for each row execute function graftvision_private.enforce_controlled_patient_mutation();

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
    'membership.role_remove', 'membership.suspend', 'patient.create', 'patient.status_change',
    'platform.admin', 'role.assign', 'role.remove', 'session.create',
    'session.deny_inactive_user', 'session.end', 'session.expire_absolute',
    'session.expire_idle', 'session.lock', 'session.logout_after_lock',
    'session.reauthentication_failed', 'session.revoke_authorization_change',
    'session.revoke_inactive_membership', 'session.revoke_inactive_user',
    'session.revoke_other', 'session.revoke_others', 'session.unlock',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate'
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
    'patient', 'platform_user', 'platform_user_role', 'storage_object_key', 'system'
  );
$$;

create function graftvision_private.has_patient_root_authority(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_non_doctor_permission boolean;
  v_verified_doctor_permission boolean;
begin
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  if v_clinic_id is null
    or not graftvision_private.is_clinic_ready(v_clinic_id)
    or not graftvision_private.has_application_session_permission(
      p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'PATIENT-PERM-001'
    ) then
    return false;
  end if;

  select exists (
    select 1
    from public.clinic_membership m
    join public.clinic_membership_role mr on mr.clinic_membership_id = m.id
    join public.role_permission rp
      on rp.role_code = mr.role_code and rp.permission_id = 'PATIENT-PERM-001'
    where m.clinic_id = v_clinic_id
      and m.platform_user_id = p_provider_identity_id
      and m.membership_status = 'active'
      and mr.role_code <> 'DOCTOR'
  ) into v_non_doctor_permission;

  select exists (
    select 1
    from public.clinic_membership m
    join public.clinic_membership_role mr
      on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
    join public.doctor_verification dv
      on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
    where m.clinic_id = v_clinic_id
      and m.platform_user_id = p_provider_identity_id
      and m.membership_status = 'active'
      and dv.status = 'verified'
      and dv.expires_at > clock_timestamp()
  ) into v_verified_doctor_permission;

  return v_non_doctor_permission or v_verified_doctor_permission;
end;
$$;

revoke all on function graftvision_private.has_patient_root_authority(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.create_patient_root(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_idempotency_key uuid,
  p_status text,
  p_provenance_code text
)
returns table (
  id uuid,
  patient_number text,
  status text,
  revision integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_request_key_hash bytea;
  v_payload_hash bytea;
  v_existing record;
  v_sequence integer;
  v_patient_id uuid := gen_random_uuid();
  v_patient_number text;
begin
  if p_idempotency_key is null
    or p_status not in ('active', 'inactive')
    or p_provenance_code <> 'MANUAL_REGISTRATION' then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_CREATE_REQUEST';
  end if;
  if not graftvision_private.has_patient_root_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s
  where s.id = p_session_id;
  v_request_key_hash := extensions.digest(p_idempotency_key::text, 'sha256');
  v_payload_hash := extensions.digest(p_status || ':' || p_provenance_code, 'sha256');

  select i.payload_hash, i.patient_id into v_existing
  from public.patient_creation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'patient.create'
    and i.request_key_hash = v_request_key_hash
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
    select p.id, p.patient_number, p.status, p.revision, p.created_at, p.updated_at
    from public.patient p
    where p.clinic_id = v_clinic_id and p.id = v_existing.patient_id;
    return;
  end if;

  perform set_config('graftvision.patient_controlled', 'on', true);
  insert into public.clinic_patient_counter (clinic_id, last_value)
  values (v_clinic_id, 0) on conflict (clinic_id) do nothing;
  update public.clinic_patient_counter
  set last_value = last_value + 1,
      updated_at = timezone('utc', statement_timestamp())
  where clinic_id = v_clinic_id and last_value < 999999
  returning last_value into v_sequence;
  if v_sequence is null then
    raise exception using errcode = '22003', message = 'PATIENT_NUMBER_EXHAUSTED';
  end if;
  v_patient_number := 'GV-' || lpad(v_sequence::text, 6, '0');

  insert into public.patient (
    id, clinic_id, patient_number, status, provenance_code,
    created_by, updated_by
  ) values (
    v_patient_id, v_clinic_id, v_patient_number, p_status, p_provenance_code,
    p_provider_identity_id, p_provider_identity_id
  );
  insert into public.patient_status_history (
    patient_id, clinic_id, previous_status, new_status, action_code,
    previous_revision, new_revision, provenance_code, actor_platform_user_id
  ) values (
    v_patient_id, v_clinic_id, null, p_status, 'created',
    0, 1, p_provenance_code, p_provider_identity_id
  );
  insert into public.patient_creation_idempotency (
    clinic_id, actor_platform_user_id, request_family,
    request_key_hash, payload_hash, patient_id
  ) values (
    v_clinic_id, p_provider_identity_id, 'patient.create',
    v_request_key_hash, v_payload_hash, v_patient_id
  );
  perform set_config('graftvision.patient_controlled', 'off', true);

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.create',
    'patient', v_patient_id, 'success', p_provenance_code, 'database', '{}'::jsonb
  );

  return query
  select p.id, p.patient_number, p.status, p.revision, p.created_at, p.updated_at
  from public.patient p where p.id = v_patient_id;
end;
$$;

revoke all on function graftvision_private.create_patient_root(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

create function graftvision_private.read_patient_root(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid
)
returns table (
  id uuid,
  patient_number text,
  status text,
  revision integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
begin
  if not graftvision_private.has_patient_root_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s
  where s.id = p_session_id;
  return query
  select p.id, p.patient_number, p.status, p.revision, p.created_at, p.updated_at
  from public.patient p
  where p.clinic_id = v_clinic_id and p.id = p_patient_id;
end;
$$;

revoke all on function graftvision_private.read_patient_root(uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.change_patient_status(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_expected_revision integer,
  p_new_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_patient public.patient%rowtype;
begin
  if p_new_status not in ('active', 'inactive') or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_STATUS_REQUEST';
  end if;
  if not graftvision_private.has_patient_root_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s
  where s.id = p_session_id;
  select * into v_patient from public.patient p
  where p.clinic_id = v_clinic_id and p.id = p_patient_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_patient.revision <> p_expected_revision then
    return 'conflict';
  end if;
  if v_patient.status = p_new_status then
    return 'unchanged';
  end if;

  perform set_config('graftvision.patient_controlled', 'on', true);
  update public.patient
  set status = p_new_status,
      revision = revision + 1,
      updated_at = timezone('utc', statement_timestamp()),
      updated_by = p_provider_identity_id
  where id = p_patient_id and clinic_id = v_clinic_id;
  insert into public.patient_status_history (
    patient_id, clinic_id, previous_status, new_status, action_code,
    previous_revision, new_revision, provenance_code, actor_platform_user_id
  ) values (
    p_patient_id, v_clinic_id, v_patient.status, p_new_status, 'status_changed',
    v_patient.revision, v_patient.revision + 1, v_patient.provenance_code,
    p_provider_identity_id
  );
  perform set_config('graftvision.patient_controlled', 'off', true);

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.status_change',
    'patient', p_patient_id, 'success', 'STATUS_CHANGED', 'database',
    jsonb_build_object('previous_status', v_patient.status, 'new_status', p_new_status)
  );
  return 'updated';
end;
$$;

revoke all on function graftvision_private.change_patient_status(
  uuid, uuid, uuid, integer, text
) from public, anon, authenticated;
