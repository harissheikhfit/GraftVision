-- GraftVision migration
-- Task: PATIENT-006
-- Purpose: Add reversible patient archive/restore lifecycle controls.
-- Created UTC: 20260729000003
-- Compatibility: Additive only; patient active/inactive status and the 13-role/58-permission catalogues are unchanged.
-- graftvision:dangerous-sql-approved task=PATIENT-006
-- graftvision:dangerous-sql-reason Reviewed controlled lifecycle transitions, immutable history, tenant isolation, idempotency, and archive-aware projections.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

alter table public.patient
  add column lifecycle_state text not null default 'current'
    check (lifecycle_state in ('current', 'archived')),
  add column lifecycle_revision integer not null default 1
    check (lifecycle_revision > 0),
  add column archived_at timestamptz,
  add column archive_reason_code text,
  add column archived_by uuid references public.platform_user(id),
  add constraint patient_archive_state_check check (
    (lifecycle_state = 'current'
      and archived_at is null and archive_reason_code is null and archived_by is null)
    or
    (lifecycle_state = 'archived'
      and archived_at is not null and archive_reason_code is not null and archived_by is not null)
  );

create table public.patient_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  previous_state text not null check (previous_state in ('current', 'archived')),
  new_state text not null check (new_state in ('current', 'archived')),
  previous_revision integer not null check (previous_revision > 0),
  new_revision integer not null check (new_revision = previous_revision + 1),
  reason_code text not null check (reason_code in (
    'duplicate_created_in_error', 'patient_requested_inactive_record',
    'registered_in_error', 'no_longer_receiving_services',
    'administrative_cleanup', 'other_controlled', 'patient_returned',
    'archived_in_error', 'record_review_completed', 'administrative_restore'
  )),
  actor_platform_user_id uuid not null references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp(),
  audit_reference_id uuid,
  constraint patient_lifecycle_history_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
);

create table public.patient_lifecycle_idempotency (
  clinic_id uuid not null,
  actor_platform_user_id uuid not null references public.platform_user(id),
  idempotency_key uuid not null,
  patient_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  lifecycle_history_id uuid not null references public.patient_lifecycle_history(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, idempotency_key),
  constraint patient_lifecycle_idempotency_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
);

create index patient_lifecycle_history_patient_idx
  on public.patient_lifecycle_history (clinic_id, patient_id, occurred_at desc);
create index patient_lifecycle_search_idx
  on public.patient (clinic_id, lifecycle_state, status, created_at desc, id desc);

alter table public.patient_lifecycle_history enable row level security;
alter table public.patient_lifecycle_history force row level security;
alter table public.patient_lifecycle_idempotency enable row level security;
alter table public.patient_lifecycle_idempotency force row level security;
revoke all on table public.patient_lifecycle_history from public, anon, authenticated;
revoke all on table public.patient_lifecycle_idempotency from public, anon, authenticated;

create trigger patient_lifecycle_history_controlled
before insert on public.patient_lifecycle_history
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_lifecycle_history_immutable
before update or delete on public.patient_lifecycle_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();
create trigger patient_lifecycle_idempotency_controlled
before insert or update or delete on public.patient_lifecycle_idempotency
for each row execute function graftvision_private.enforce_controlled_patient_mutation();

create function graftvision_private.is_patient_workflow_available(
  p_clinic_id uuid,
  p_patient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient p
    where p.clinic_id = p_clinic_id
      and p.id = p_patient_id
      and p.lifecycle_state = 'current'
  );
$$;
revoke all on function graftvision_private.is_patient_workflow_available(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.deny_archived_patient_privacy_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not graftvision_private.is_patient_workflow_available(
    coalesce(new.clinic_id, old.clinic_id), coalesce(new.patient_id, old.patient_id)
  ) then
    raise exception using errcode = '42501', message = 'PATIENT_ARCHIVED';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function graftvision_private.deny_archived_patient_privacy_mutation()
  from public, anon, authenticated;
create trigger patient_privacy_archive_guard
before insert or update on public.patient_privacy_acknowledgement
for each row execute function graftvision_private.deny_archived_patient_privacy_mutation();

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

create function graftvision_private.transition_patient_lifecycle(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_expected_revision integer,
  p_target_state text,
  p_reason_code text,
  p_idempotency_key uuid
)
returns table(patient_id uuid, lifecycle_state text, lifecycle_revision integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_patient public.patient%rowtype;
  v_request_hash text;
  v_existing public.patient_lifecycle_idempotency%rowtype;
  v_history_id uuid := gen_random_uuid();
  v_action text;
begin
  if p_patient_id is null or p_expected_revision < 1 or p_idempotency_key is null
    or p_target_state not in ('current', 'archived')
    or (
      p_target_state = 'archived' and p_reason_code not in (
        'duplicate_created_in_error', 'patient_requested_inactive_record',
        'registered_in_error', 'no_longer_receiving_services',
        'administrative_cleanup', 'other_controlled'
      )
    )
    or (
      p_target_state = 'current' and p_reason_code not in (
        'patient_returned', 'archived_in_error',
        'record_review_completed', 'administrative_restore'
      )
    ) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_LIFECYCLE_REQUEST';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id, s.platform_user_id into v_clinic_id, v_actor_id
  from public.application_session s where s.id = p_session_id;
  v_request_hash := encode(extensions.digest(concat_ws(
    '|', p_patient_id::text, p_expected_revision::text, p_target_state, p_reason_code
  ), 'sha256'), 'hex');

  select * into v_existing
  from public.patient_lifecycle_idempotency i
  where i.clinic_id = v_clinic_id and i.actor_platform_user_id = v_actor_id
    and i.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select p.id, p.lifecycle_state, p.lifecycle_revision
      from public.patient p
      where p.clinic_id = v_clinic_id and p.id = v_existing.patient_id;
    return;
  end if;

  select * into v_patient from public.patient p
  where p.clinic_id = v_clinic_id and p.id = p_patient_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'PATIENT_NOT_FOUND'; end if;
  if v_patient.lifecycle_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PATIENT_LIFECYCLE_CONFLICT';
  end if;
  if v_patient.lifecycle_state = p_target_state then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_LIFECYCLE_TRANSITION';
  end if;

  perform set_config('graftvision.patient_controlled', 'on', true);
  update public.patient p set
    lifecycle_state = p_target_state,
    lifecycle_revision = p.lifecycle_revision + 1,
    archived_at = case when p_target_state = 'archived' then clock_timestamp() else null end,
    archive_reason_code = case when p_target_state = 'archived' then p_reason_code else null end,
    archived_by = case when p_target_state = 'archived' then v_actor_id else null end,
    updated_at = clock_timestamp(),
    updated_by = v_actor_id
  where p.clinic_id = v_clinic_id and p.id = p_patient_id;

  insert into public.patient_lifecycle_history (
    id, clinic_id, patient_id, previous_state, new_state, previous_revision,
    new_revision, reason_code, actor_platform_user_id
  ) values (
    v_history_id, v_clinic_id, p_patient_id, v_patient.lifecycle_state,
    p_target_state, p_expected_revision, p_expected_revision + 1,
    p_reason_code, v_actor_id
  );
  insert into public.patient_lifecycle_idempotency (
    clinic_id, actor_platform_user_id, idempotency_key, patient_id,
    request_hash, lifecycle_history_id
  ) values (
    v_clinic_id, v_actor_id, p_idempotency_key, p_patient_id,
    v_request_hash, v_history_id
  );
  v_action := case when p_target_state = 'archived' then 'patient.archive' else 'patient.restore' end;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', v_action,
    'patient', p_patient_id, 'success', p_reason_code, 'database',
    jsonb_build_object(
      'previous_status', v_patient.lifecycle_state,
      'new_status', p_target_state,
      'affected_count', p_expected_revision + 1
    )
  );
  return query select p.id, p.lifecycle_state, p.lifecycle_revision
    from public.patient p where p.clinic_id = v_clinic_id and p.id = p_patient_id;
end;
$$;
revoke all on function graftvision_private.transition_patient_lifecycle(
  uuid, uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated;

create function graftvision_private.read_patient_profile_lifecycle(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_include_inactive boolean default false,
  p_include_archived boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_patient public.patient%rowtype;
  v_result jsonb;
  v_lifecycle_events jsonb;
begin
  if p_include_archived is null then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_PROFILE_REQUEST';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s where s.id = p_session_id;
  select * into v_patient from public.patient p
  where p.clinic_id = v_clinic_id and p.id = p_patient_id;
  if not found or (v_patient.lifecycle_state = 'archived' and not p_include_archived) then
    return null;
  end if;
  v_result := graftvision_private.read_patient_profile(
    p_session_id, p_provider_identity_id, p_patient_id,
    p_include_inactive or v_patient.lifecycle_state = 'archived'
  );
  if v_result is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'eventCode', case when h.new_state = 'archived' then 'PATIENT_ARCHIVED' else 'PATIENT_RESTORED' end,
    'label', case when h.new_state = 'archived' then 'Patient record archived' else 'Patient record restored' end,
    'occurredAt', h.occurred_at, 'referenceId', h.id
  ) order by h.occurred_at desc, h.id desc), '[]'::jsonb)
  into v_lifecycle_events
  from public.patient_lifecycle_history h
  where h.clinic_id = v_clinic_id and h.patient_id = p_patient_id;
  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result, '{profile,lifecycleState}', to_jsonb(v_patient.lifecycle_state), true),
      '{profile,lifecycleRevision}', to_jsonb(v_patient.lifecycle_revision), true
    ),
    '{timeline}', (v_result->'timeline') || v_lifecycle_events, true
  );
end;
$$;
revoke all on function graftvision_private.read_patient_profile_lifecycle(
  uuid, uuid, uuid, boolean, boolean
) from public, anon, authenticated;

create function graftvision_private.search_patients_lifecycle(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_query text default null,
  p_status text default 'active',
  p_created_from date default null,
  p_created_to date default null,
  p_cursor text default null,
  p_direction text default 'next',
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_rows jsonb;
  v_base jsonb;
begin
  if p_status not in ('active', 'inactive', 'archived')
    or p_direction not in ('next', 'previous') or p_page_size not between 1 and 100
    or (p_status = 'archived' and p_cursor is not null)
    or char_length(coalesce(p_query, '')) > 160
    or (p_created_from is not null and p_created_to is not null and p_created_from > p_created_to)
  then raise exception using errcode = '22023', message = 'INVALID_PATIENT_SEARCH'; end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id from public.application_session s where s.id = p_session_id;
  if p_status in ('active', 'inactive') then
    v_base := graftvision_private.search_patients(
      p_session_id, p_provider_identity_id, p_query, p_status, p_created_from,
      p_created_to, p_cursor, p_direction, p_page_size
    );
    select coalesce(jsonb_agg(item), '[]'::jsonb) into v_rows
    from jsonb_array_elements(v_base->'patients') item
    join public.patient p
      on p.clinic_id = v_clinic_id
      and p.id = (item->>'id')::uuid
      and p.lifecycle_state = 'current';
    return jsonb_set(v_base, '{patients}', v_rows, true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'patientNumber', q.patient_number, 'maskedName', q.masked_name,
    'hasPhone', true, 'hasEmail', q.has_email, 'status', q.status,
    'revision', q.revision, 'createdAt', q.created_at,
    'lifecycleState', q.lifecycle_state, 'lifecycleRevision', q.lifecycle_revision
  ) order by q.created_at desc, q.id desc), '[]'::jsonb)
  into v_rows
  from (
    select p.id, p.patient_number, p.status, p.revision, p.created_at,
      p.lifecycle_state, p.lifecycle_revision,
      left(r.full_name, 1) || repeat('•', greatest(char_length(r.full_name) - 1, 1)) masked_name,
      r.email is not null has_email
    from public.patient p
    join public.patient_registration r on r.clinic_id = p.clinic_id and r.patient_id = p.id
    where p.clinic_id = v_clinic_id
      and p.lifecycle_state = 'archived'
      and (p_created_from is null or p.created_at >= p_created_from::timestamptz)
      and (p_created_to is null or p.created_at < (p_created_to + 1)::timestamptz)
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or p.patient_number ilike btrim(p_query) || '%'
        or r.normalised_name like graftvision_private.normalise_patient_name(p_query) || '%'
        or r.phone like regexp_replace(btrim(p_query), '[[:space:]().-]+', '', 'g') || '%'
        or r.email like lower(btrim(p_query)) || '%'
      )
    order by p.created_at desc, p.id desc
    limit p_page_size
  ) q;
  return jsonb_build_object('patients', v_rows, 'nextCursor', null, 'previousCursor', null);
end;
$$;
revoke all on function graftvision_private.search_patients_lifecycle(
  uuid, uuid, text, text, date, date, text, text, integer
) from public, anon, authenticated;
