-- GraftVision migration
-- Task: CONSULT-001
-- Purpose: Add the tenant-scoped consultation root, controlled lifecycle, and Doctor assignment.
-- Created UTC: 20260729000006
-- Compatibility: Additive only; adds exactly CONSULT-PERM-003 and preserves all existing role mappings.
-- graftvision:dangerous-sql-approved task=CONSULT-001
-- graftvision:dangerous-sql-reason Reviewed consultation tenant isolation, lifecycle, assignment, idempotency, immutable history, forced RLS, and audit actions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

insert into public.permission_definition (permission_id)
values ('CONSULT-PERM-003');

insert into public.role_permission (role_code, permission_id) values
  ('CLINIC_OWNER', 'CONSULT-PERM-003'),
  ('CLINIC_ADMIN', 'CONSULT-PERM-003');

create table public.consultation (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null,
  status text not null default 'draft' check (status in (
    'draft', 'in_progress', 'capture_complete', 'review_required', 'completed', 'cancelled'
  )),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  constraint consultation_clinic_id_unique unique (clinic_id, id),
  constraint consultation_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
);

create table public.consultation_assignment (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  doctor_platform_user_id uuid not null references public.platform_user(id),
  revision integer not null default 1 check (revision > 0),
  assigned_at timestamptz not null default clock_timestamp(),
  assigned_by uuid not null references public.platform_user(id),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  constraint consultation_assignment_consultation_unique unique (consultation_id),
  constraint consultation_assignment_clinic_consultation_unique unique (clinic_id, consultation_id),
  constraint consultation_assignment_consultation_fk
    foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.consultation_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  previous_status text check (previous_status is null or previous_status in (
    'draft', 'in_progress', 'capture_complete', 'review_required', 'completed', 'cancelled'
  )),
  new_status text not null check (new_status in (
    'draft', 'in_progress', 'capture_complete', 'review_required', 'completed', 'cancelled'
  )),
  previous_revision integer not null check (previous_revision >= 0),
  new_revision integer not null check (new_revision = previous_revision + 1),
  reason_code text not null check (reason_code in (
    'CONSULTATION_CREATED', 'PREPARATION_STARTED', 'PREPARATION_RESUMED',
    'CONSULTATION_CANCELLED'
  )),
  actor_platform_user_id uuid not null references public.platform_user(id),
  request_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint consultation_status_history_consultation_fk
    foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.consultation_assignment_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  previous_doctor_platform_user_id uuid references public.platform_user(id),
  new_doctor_platform_user_id uuid not null references public.platform_user(id),
  previous_revision integer not null check (previous_revision >= 0),
  new_revision integer not null check (new_revision = previous_revision + 1),
  reason_code text not null check (reason_code in (
    'INITIAL_ASSIGNMENT', 'CASELOAD_REBALANCE', 'DOCTOR_UNAVAILABLE',
    'CLINIC_ADMINISTRATIVE_CHANGE'
  )),
  actor_platform_user_id uuid not null references public.platform_user(id),
  request_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint consultation_assignment_history_consultation_fk
    foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.consultation_operation_idempotency (
  clinic_id uuid not null,
  actor_platform_user_id uuid not null references public.platform_user(id),
  request_family text not null check (request_family in (
    'consultation.create', 'consultation.doctor_assign', 'consultation.status_change'
  )),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  consultation_id uuid not null,
  result_revision integer not null check (result_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_family, idempotency_key),
  constraint consultation_operation_idempotency_consultation_fk
    foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create index consultation_patient_idx
  on public.consultation (clinic_id, patient_id, created_at desc, id desc);
create index consultation_status_idx
  on public.consultation (clinic_id, status, created_at desc, id desc);
create index consultation_assignment_doctor_idx
  on public.consultation_assignment (clinic_id, doctor_platform_user_id, assigned_at desc);
create index consultation_status_history_idx
  on public.consultation_status_history (clinic_id, consultation_id, occurred_at, id);
create index consultation_assignment_history_idx
  on public.consultation_assignment_history (clinic_id, consultation_id, occurred_at, id);

alter table public.consultation enable row level security;
alter table public.consultation force row level security;
alter table public.consultation_assignment enable row level security;
alter table public.consultation_assignment force row level security;
alter table public.consultation_status_history enable row level security;
alter table public.consultation_status_history force row level security;
alter table public.consultation_assignment_history enable row level security;
alter table public.consultation_assignment_history force row level security;
alter table public.consultation_operation_idempotency enable row level security;
alter table public.consultation_operation_idempotency force row level security;

revoke all on table public.consultation from public, anon, authenticated;
revoke all on table public.consultation_assignment from public, anon, authenticated;
revoke all on table public.consultation_status_history from public, anon, authenticated;
revoke all on table public.consultation_assignment_history from public, anon, authenticated;
revoke all on table public.consultation_operation_idempotency from public, anon, authenticated;

create function graftvision_private.enforce_controlled_consultation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.consultation_controlled', true) <> 'on' then
    raise exception using errcode = '42501', message = 'CONSULTATION_CONTROLLED_MUTATION_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function graftvision_private.enforce_controlled_consultation_mutation()
  from public, anon, authenticated;

create function graftvision_private.prevent_consultation_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'CONSULTATION_HISTORY_IMMUTABLE';
end;
$$;
revoke all on function graftvision_private.prevent_consultation_history_mutation()
  from public, anon, authenticated;

create trigger consultation_controlled
before insert or update or delete on public.consultation
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger consultation_assignment_controlled
before insert or update or delete on public.consultation_assignment
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger consultation_status_history_controlled
before insert on public.consultation_status_history
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger consultation_status_history_immutable
before update or delete on public.consultation_status_history
for each row execute function graftvision_private.prevent_consultation_history_mutation();
create trigger consultation_assignment_history_controlled
before insert on public.consultation_assignment_history
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger consultation_assignment_history_immutable
before update or delete on public.consultation_assignment_history
for each row execute function graftvision_private.prevent_consultation_history_mutation();
create trigger consultation_operation_idempotency_controlled
before insert or update or delete on public.consultation_operation_idempotency
for each row execute function graftvision_private.enforce_controlled_consultation_mutation();

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
    'clinic.settings_view', 'clinic.suspend', 'consultation.create',
    'consultation.doctor_assign', 'consultation.doctor_reassign',
    'consultation.status_change', 'doctor.verification.expired',
    'doctor.verification.pending', 'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate',
    'membership.read', 'membership.reactivate', 'membership.role_assign',
    'membership.role_remove', 'membership.suspend', 'patient.archive', 'patient.create',
    'patient.duplicate_override', 'patient.duplicate_warning', 'patient.privacy_acknowledge',
    'patient.privacy_withdraw', 'patient.registration_create', 'patient.restore',
    'patient.status_change', 'platform.admin', 'role.assign', 'role.remove', 'session.create',
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
    'clinic_membership', 'clinic_membership_role', 'consultation',
    'consultation_assignment', 'doctor_verification', 'patient',
    'patient_privacy_acknowledgement', 'platform_user', 'platform_user_role',
    'storage_object_key', 'system'
  );
$$;

create function graftvision_private.has_consultation_authority(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_permission_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_non_doctor_permission boolean;
  v_doctor_permission boolean;
begin
  select s.clinic_id into v_clinic_id
  from public.application_session s
  where s.id = p_session_id;

  if v_clinic_id is null
    or p_permission_id not in ('CONSULT-PERM-001', 'CONSULT-PERM-003')
    or not graftvision_private.is_clinic_ready(v_clinic_id)
    or not graftvision_private.has_application_session_permission(
      p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, p_permission_id
    ) then
    return false;
  end if;

  select exists (
    select 1
    from public.clinic_membership m
    join public.clinic_membership_role mr on mr.clinic_membership_id = m.id
    join public.role_permission rp
      on rp.role_code = mr.role_code and rp.permission_id = p_permission_id
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
    join public.role_permission rp
      on rp.role_code = mr.role_code and rp.permission_id = p_permission_id
    join public.doctor_verification dv
      on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
    where m.clinic_id = v_clinic_id
      and m.platform_user_id = p_provider_identity_id
      and m.membership_status = 'active'
      and dv.status = 'verified'
      and dv.expires_at > clock_timestamp()
  ) into v_doctor_permission;

  return v_non_doctor_permission or v_doctor_permission;
end;
$$;
revoke all on function graftvision_private.has_consultation_authority(uuid, uuid, text)
  from public, anon, authenticated;

create function graftvision_private.is_assignable_consultation_doctor(
  p_clinic_id uuid,
  p_doctor_platform_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_user u
    join public.clinic_membership m
      on m.platform_user_id = u.id and m.clinic_id = p_clinic_id
    join public.clinic_membership_role mr
      on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
    join public.doctor_verification dv
      on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
    where u.id = p_doctor_platform_user_id
      and u.status = 'active'
      and m.membership_status = 'active'
      and dv.status = 'verified'
      and dv.expires_at > clock_timestamp()
  );
$$;
revoke all on function graftvision_private.is_assignable_consultation_doctor(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.create_consultation(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_idempotency_key uuid
)
returns table (
  id uuid,
  patient_id uuid,
  assigned_doctor_platform_user_id uuid,
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
  v_consultation_id uuid := gen_random_uuid();
  v_payload_hash text;
  v_existing public.consultation_operation_idempotency%rowtype;
begin
  if p_patient_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_CONSULTATION_CREATE_REQUEST';
  end if;
  if not graftvision_private.has_consultation_authority(
    p_session_id, p_provider_identity_id, 'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;

  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;

  if not exists (
    select 1 from public.patient p
    where p.clinic_id = v_clinic_id and p.id = p_patient_id
      and p.status = 'active'
      and graftvision_private.is_patient_workflow_available(p.clinic_id, p.id)
  ) then
    raise exception using errcode = 'P0002', message = 'PATIENT_NOT_ELIGIBLE';
  end if;

  v_payload_hash := encode(extensions.digest(p_patient_id::text, 'sha256'), 'hex');
  select * into v_existing
  from public.consultation_operation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'consultation.create'
    and i.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
    select c.id, c.patient_id, a.doctor_platform_user_id, c.status, c.revision,
      c.created_at, c.updated_at
    from public.consultation c
    left join public.consultation_assignment a on a.consultation_id = c.id
    where c.clinic_id = v_clinic_id and c.id = v_existing.consultation_id;
    return;
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);
  insert into public.consultation (
    id, clinic_id, patient_id, status, revision, created_by, updated_by
  ) values (
    v_consultation_id, v_clinic_id, p_patient_id, 'draft', 1,
    p_provider_identity_id, p_provider_identity_id
  );
  insert into public.consultation_status_history (
    clinic_id, consultation_id, previous_status, new_status,
    previous_revision, new_revision, reason_code, actor_platform_user_id, request_id
  ) values (
    v_clinic_id, v_consultation_id, null, 'draft', 0, 1,
    'CONSULTATION_CREATED', p_provider_identity_id, p_idempotency_key
  );
  insert into public.consultation_operation_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, consultation_id, result_revision
  ) values (
    v_clinic_id, p_provider_identity_id, 'consultation.create', p_idempotency_key,
    v_payload_hash, v_consultation_id, 1
  );
  perform set_config('graftvision.consultation_controlled', 'off', true);

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'consultation.create',
    'consultation', v_consultation_id, 'success', 'CONSULTATION_CREATED',
    'database', '{}'::jsonb
  );

  return query
  select c.id, c.patient_id, a.doctor_platform_user_id, c.status, c.revision,
    c.created_at, c.updated_at
  from public.consultation c
  left join public.consultation_assignment a on a.consultation_id = c.id
  where c.id = v_consultation_id;
end;
$$;
revoke all on function graftvision_private.create_consultation(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.read_consultation(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_consultation_id uuid
)
returns table (
  id uuid,
  patient_id uuid,
  assigned_doctor_platform_user_id uuid,
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
  if not graftvision_private.has_consultation_authority(
    p_session_id, p_provider_identity_id, 'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  return query
  select c.id, c.patient_id, a.doctor_platform_user_id, c.status, c.revision,
    c.created_at, c.updated_at
  from public.consultation c
  left join public.consultation_assignment a on a.consultation_id = c.id
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
end;
$$;
revoke all on function graftvision_private.read_consultation(uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.list_consultations(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid
)
returns table (
  id uuid,
  patient_id uuid,
  assigned_doctor_platform_user_id uuid,
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
  if not graftvision_private.has_consultation_authority(
    p_session_id, p_provider_identity_id, 'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  return query
  select c.id, c.patient_id, a.doctor_platform_user_id, c.status, c.revision,
    c.created_at, c.updated_at
  from public.consultation c
  left join public.consultation_assignment a on a.consultation_id = c.id
  where c.clinic_id = v_clinic_id
    and (p_patient_id is null or c.patient_id = p_patient_id)
  order by c.created_at desc, c.id desc;
end;
$$;
revoke all on function graftvision_private.list_consultations(uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.assign_consultation_doctor(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_consultation_id uuid,
  p_doctor_platform_user_id uuid,
  p_expected_revision integer,
  p_reason_code text,
  p_idempotency_key uuid
)
returns table (
  consultation_id uuid,
  doctor_platform_user_id uuid,
  revision integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_consultation public.consultation%rowtype;
  v_assignment public.consultation_assignment%rowtype;
  v_previous_doctor_id uuid;
  v_payload_hash text;
  v_existing public.consultation_operation_idempotency%rowtype;
  v_action text;
begin
  if p_consultation_id is null or p_doctor_platform_user_id is null
    or p_idempotency_key is null or p_expected_revision < 1
    or p_reason_code not in (
      'INITIAL_ASSIGNMENT', 'CASELOAD_REBALANCE', 'DOCTOR_UNAVAILABLE',
      'CLINIC_ADMINISTRATIVE_CHANGE'
    ) then
    raise exception using errcode = '22023', message = 'INVALID_CONSULTATION_ASSIGNMENT_REQUEST';
  end if;
  if not graftvision_private.has_consultation_authority(
    p_session_id, p_provider_identity_id, 'CONSULT-PERM-003'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  if not graftvision_private.is_assignable_consultation_doctor(
    v_clinic_id, p_doctor_platform_user_id
  ) then
    raise exception using errcode = '42501', message = 'DOCTOR_AUTHORITY_DENIED';
  end if;

  v_payload_hash := encode(extensions.digest(concat_ws(
    '|', p_consultation_id::text, p_doctor_platform_user_id::text,
    p_expected_revision::text, p_reason_code
  ), 'sha256'), 'hex');
  select * into v_existing
  from public.consultation_operation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'consultation.doctor_assign'
    and i.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
    select a.consultation_id, a.doctor_platform_user_id, c.revision
    from public.consultation_assignment a
    join public.consultation c on c.id = a.consultation_id
    where a.clinic_id = v_clinic_id and a.consultation_id = v_existing.consultation_id;
    return;
  end if;

  select * into v_consultation from public.consultation c
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CONSULTATION_NOT_FOUND';
  end if;
  if v_consultation.status in ('completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'CONSULTATION_NOT_ASSIGNABLE';
  end if;
  if v_consultation.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'CONSULTATION_REVISION_CONFLICT';
  end if;

  select * into v_assignment from public.consultation_assignment a
  where a.clinic_id = v_clinic_id and a.consultation_id = p_consultation_id;
  v_previous_doctor_id := v_assignment.doctor_platform_user_id;
  if v_previous_doctor_id = p_doctor_platform_user_id then
    raise exception using errcode = '22023', message = 'CONSULTATION_DOCTOR_UNCHANGED';
  end if;
  if v_previous_doctor_id is null and p_reason_code <> 'INITIAL_ASSIGNMENT' then
    raise exception using errcode = '22023', message = 'INVALID_INITIAL_ASSIGNMENT_REASON';
  end if;
  if v_previous_doctor_id is not null and p_reason_code = 'INITIAL_ASSIGNMENT' then
    raise exception using errcode = '22023', message = 'INVALID_REASSIGNMENT_REASON';
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);
  if v_previous_doctor_id is null then
    insert into public.consultation_assignment (
      clinic_id, consultation_id, doctor_platform_user_id, revision,
      assigned_by, updated_by
    ) values (
      v_clinic_id, p_consultation_id, p_doctor_platform_user_id, 1,
      p_provider_identity_id, p_provider_identity_id
    );
    v_action := 'consultation.doctor_assign';
  else
    update public.consultation_assignment a
    set doctor_platform_user_id = p_doctor_platform_user_id,
        revision = a.revision + 1,
        updated_at = clock_timestamp(),
        updated_by = p_provider_identity_id
    where a.clinic_id = v_clinic_id and a.consultation_id = p_consultation_id;
    v_action := 'consultation.doctor_reassign';
  end if;
  update public.consultation c
  set revision = c.revision + 1, updated_at = clock_timestamp(),
      updated_by = p_provider_identity_id
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
  insert into public.consultation_assignment_history (
    clinic_id, consultation_id, previous_doctor_platform_user_id,
    new_doctor_platform_user_id, previous_revision, new_revision,
    reason_code, actor_platform_user_id, request_id
  ) values (
    v_clinic_id, p_consultation_id, v_previous_doctor_id,
    p_doctor_platform_user_id, p_expected_revision, p_expected_revision + 1,
    p_reason_code, p_provider_identity_id, p_idempotency_key
  );
  insert into public.consultation_operation_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, consultation_id, result_revision
  ) values (
    v_clinic_id, p_provider_identity_id, 'consultation.doctor_assign',
    p_idempotency_key, v_payload_hash, p_consultation_id, p_expected_revision + 1
  );
  perform set_config('graftvision.consultation_controlled', 'off', true);

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', v_action,
    'consultation_assignment', p_consultation_id, 'success', p_reason_code,
    'database', '{}'::jsonb
  );

  return query
  select a.consultation_id, a.doctor_platform_user_id, c.revision
  from public.consultation_assignment a
  join public.consultation c on c.id = a.consultation_id
  where a.clinic_id = v_clinic_id and a.consultation_id = p_consultation_id;
end;
$$;
revoke all on function graftvision_private.assign_consultation_doctor(
  uuid, uuid, uuid, uuid, integer, text, uuid
) from public, anon, authenticated;

create function graftvision_private.transition_consultation_status(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_consultation_id uuid,
  p_expected_revision integer,
  p_new_status text,
  p_reason_code text,
  p_idempotency_key uuid
)
returns table (consultation_id uuid, status text, revision integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_consultation public.consultation%rowtype;
  v_payload_hash text;
  v_existing public.consultation_operation_idempotency%rowtype;
begin
  if p_consultation_id is null or p_idempotency_key is null
    or p_expected_revision < 1
    or p_new_status not in ('in_progress', 'cancelled')
    or (p_new_status = 'in_progress' and p_reason_code not in (
      'PREPARATION_STARTED', 'PREPARATION_RESUMED'
    ))
    or (p_new_status = 'cancelled' and p_reason_code <> 'CONSULTATION_CANCELLED') then
    raise exception using errcode = '22023', message = 'INVALID_CONSULTATION_STATUS_REQUEST';
  end if;
  if not graftvision_private.has_consultation_authority(
    p_session_id, p_provider_identity_id, 'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;

  v_payload_hash := encode(extensions.digest(concat_ws(
    '|', p_consultation_id::text, p_expected_revision::text, p_new_status, p_reason_code
  ), 'sha256'), 'hex');
  select * into v_existing
  from public.consultation_operation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'consultation.status_change'
    and i.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
    select c.id, c.status, c.revision from public.consultation c
    where c.clinic_id = v_clinic_id and c.id = v_existing.consultation_id;
    return;
  end if;

  select * into v_consultation from public.consultation c
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CONSULTATION_NOT_FOUND';
  end if;
  if v_consultation.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'CONSULTATION_REVISION_CONFLICT';
  end if;
  if not (
    (v_consultation.status = 'draft' and p_new_status in ('in_progress', 'cancelled'))
    or (v_consultation.status = 'in_progress' and p_new_status = 'cancelled')
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CONSULTATION_TRANSITION';
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);
  update public.consultation c
  set status = p_new_status, revision = c.revision + 1,
      updated_at = clock_timestamp(), updated_by = p_provider_identity_id
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
  insert into public.consultation_status_history (
    clinic_id, consultation_id, previous_status, new_status,
    previous_revision, new_revision, reason_code, actor_platform_user_id, request_id
  ) values (
    v_clinic_id, p_consultation_id, v_consultation.status, p_new_status,
    p_expected_revision, p_expected_revision + 1, p_reason_code,
    p_provider_identity_id, p_idempotency_key
  );
  insert into public.consultation_operation_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, consultation_id, result_revision
  ) values (
    v_clinic_id, p_provider_identity_id, 'consultation.status_change',
    p_idempotency_key, v_payload_hash, p_consultation_id, p_expected_revision + 1
  );
  perform set_config('graftvision.consultation_controlled', 'off', true);

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user',
    'consultation.status_change', 'consultation', p_consultation_id,
    'success', p_reason_code, 'database',
    jsonb_build_object('previous_status', v_consultation.status, 'new_status', p_new_status)
  );

  return query
  select c.id, c.status, c.revision from public.consultation c
  where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
end;
$$;
revoke all on function graftvision_private.transition_consultation_status(
  uuid, uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated;
