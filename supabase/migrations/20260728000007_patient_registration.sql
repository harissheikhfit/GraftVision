-- GraftVision migration
-- Task: PATIENT-002
-- Purpose: Add bounded patient registration, deterministic duplicate warnings, override decisions, and privacy-safe projections.
-- Created UTC: 20260728000007
-- Compatibility: Additive only; PATIENT-001 numbering and the 13-role/58-permission catalogues remain unchanged.
-- Privacy: Synthetic registration data only. Real-patient use remains blocked pending privacy/legal approval.
-- graftvision:dangerous-sql-approved task=PATIENT-002
-- graftvision:dangerous-sql-reason Reviewed controlled registration, duplicate matching, idempotency, history, RLS, and audit actions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create table public.patient_registration (
  patient_id uuid primary key,
  clinic_id uuid not null,
  full_name text not null check (
    char_length(full_name) between 2 and 160
    and full_name = btrim(full_name)
  ),
  normalised_name text not null check (
    char_length(normalised_name) between 2 and 160
    and normalised_name = lower(normalised_name)
  ),
  date_of_birth date not null check (
    date_of_birth >= date '1900-01-01'
    and date_of_birth <= current_date
  ),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (
    email is null
    or (
      char_length(email) between 3 and 254
      and email = lower(btrim(email))
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  revision integer not null default 1 check (revision >= 1),
  provenance_code text not null check (provenance_code = 'REGISTRATION_FORM'),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  created_by uuid not null references public.platform_user(id) on update restrict on delete restrict,
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_by uuid not null references public.platform_user(id) on update restrict on delete restrict,
  constraint patient_registration_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict,
  unique (clinic_id, patient_id)
);

create table public.patient_registration_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  registration_revision integer not null check (registration_revision >= 1),
  action_code text not null check (action_code = 'registration_created'),
  provenance_code text not null check (provenance_code = 'REGISTRATION_FORM'),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint patient_registration_history_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict
);

create table public.patient_duplicate_decision_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  patient_id uuid,
  request_key_hash bytea not null check (octet_length(request_key_hash) = 32),
  decision_code text not null check (decision_code in ('warning', 'override')),
  match_reason_codes text[] not null check (
    cardinality(match_reason_codes) between 1 and 3
    and match_reason_codes <@ array['PHONE_EXACT', 'EMAIL_EXACT', 'NAME_DOB_EXACT']::text[]
  ),
  override_reason_code text check (
    (decision_code = 'warning' and override_reason_code is null)
    or (
      decision_code = 'override'
      and override_reason_code in ('CONFIRMED_DISTINCT_PERSON', 'KNOWN_SEPARATE_RECORD')
    )
  ),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint patient_duplicate_decision_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict
);

create table public.patient_registration_idempotency (
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  request_key_hash bytea not null check (octet_length(request_key_hash) = 32),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  state text not null check (state in ('warning', 'completed')),
  patient_id uuid,
  duplicate_projection jsonb not null default '[]'::jsonb
    check (jsonb_typeof(duplicate_projection) = 'array' and jsonb_array_length(duplicate_projection) <= 10),
  match_reason_codes text[] not null default '{}'::text[],
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (clinic_id, actor_platform_user_id, request_key_hash),
  constraint patient_registration_idempotency_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict,
  constraint patient_registration_idempotency_lifecycle_check check (
    (state = 'warning' and patient_id is null and completed_at is null)
    or (state = 'completed' and patient_id is not null and completed_at is not null)
  )
);

create index patient_registration_clinic_phone_idx
  on public.patient_registration (clinic_id, phone);
create index patient_registration_clinic_email_idx
  on public.patient_registration (clinic_id, email) where email is not null;
create index patient_registration_clinic_name_dob_idx
  on public.patient_registration (clinic_id, normalised_name, date_of_birth);
create index patient_registration_history_patient_time_idx
  on public.patient_registration_history (clinic_id, patient_id, occurred_at desc);
create index patient_duplicate_decision_clinic_time_idx
  on public.patient_duplicate_decision_history (clinic_id, occurred_at desc);

alter table public.patient_registration enable row level security;
alter table public.patient_registration force row level security;
alter table public.patient_registration_history enable row level security;
alter table public.patient_registration_history force row level security;
alter table public.patient_duplicate_decision_history enable row level security;
alter table public.patient_duplicate_decision_history force row level security;
alter table public.patient_registration_idempotency enable row level security;
alter table public.patient_registration_idempotency force row level security;

revoke all on table public.patient_registration from public, anon, authenticated;
revoke all on table public.patient_registration_history from public, anon, authenticated;
revoke all on table public.patient_duplicate_decision_history from public, anon, authenticated;
revoke all on table public.patient_registration_idempotency from public, anon, authenticated;

create trigger patient_registration_controlled
before insert or update or delete on public.patient_registration
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_registration_history_controlled
before insert on public.patient_registration_history
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_registration_history_immutable
before update or delete on public.patient_registration_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();
create trigger patient_duplicate_decision_history_controlled
before insert on public.patient_duplicate_decision_history
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_duplicate_decision_history_immutable
before update or delete on public.patient_duplicate_decision_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();
create trigger patient_registration_idempotency_controlled
before insert or update or delete on public.patient_registration_idempotency
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
    'membership.role_remove', 'membership.suspend', 'patient.create',
    'patient.duplicate_override', 'patient.duplicate_warning', 'patient.registration_create',
    'patient.status_change', 'platform.admin', 'role.assign', 'role.remove', 'session.create',
    'session.deny_inactive_user', 'session.end', 'session.expire_absolute',
    'session.expire_idle', 'session.lock', 'session.logout_after_lock',
    'session.reauthentication_failed', 'session.revoke_authorization_change',
    'session.revoke_inactive_membership', 'session.revoke_inactive_user',
    'session.revoke_other', 'session.revoke_others', 'session.unlock',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate'
  );
$$;

create function graftvision_private.normalise_patient_name(candidate text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(regexp_replace(btrim(candidate), '[[:space:]]+', ' ', 'g'));
$$;

revoke all on function graftvision_private.normalise_patient_name(text)
  from public, anon, authenticated;

create function graftvision_private.register_patient(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_idempotency_key uuid,
  p_full_name text,
  p_date_of_birth date,
  p_phone text,
  p_email text,
  p_provenance_code text,
  p_override_reason_code text default null
)
returns table (
  outcome text,
  id uuid,
  patient_number text,
  status text,
  revision integer,
  created_at timestamptz,
  updated_at timestamptz,
  duplicates jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_display_name text;
  v_normalised_name text;
  v_phone text;
  v_email text;
  v_request_key_hash bytea;
  v_payload_hash bytea;
  v_existing public.patient_registration_idempotency%rowtype;
  v_duplicates jsonb := '[]'::jsonb;
  v_match_reason_codes text[] := '{}'::text[];
  v_sequence integer;
  v_patient_id uuid := gen_random_uuid();
  v_patient_number text;
begin
  if p_idempotency_key is null
    or p_provenance_code <> 'REGISTRATION_FORM'
    or p_date_of_birth is null
    or p_date_of_birth < date '1900-01-01'
    or p_date_of_birth > current_date then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_REGISTRATION';
  end if;
  v_display_name := regexp_replace(btrim(p_full_name), '[[:space:]]+', ' ', 'g');
  v_normalised_name := graftvision_private.normalise_patient_name(p_full_name);
  v_phone := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]+', '', 'g');
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if char_length(v_display_name) not between 2 and 160
    or v_phone !~ '^\+[1-9][0-9]{7,14}$'
    or (
      v_email is not null
      and (
        char_length(v_email) not between 3 and 254
        or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
    or (
      p_override_reason_code is not null
      and p_override_reason_code not in ('CONFIRMED_DISTINCT_PERSON', 'KNOWN_SEPARATE_RECORD')
    ) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_REGISTRATION';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  v_request_key_hash := extensions.digest(p_idempotency_key::text, 'sha256');
  v_payload_hash := extensions.digest(
    concat_ws('|', v_display_name, p_date_of_birth::text, v_phone, coalesce(v_email, ''), p_provenance_code),
    'sha256'
  );

  select * into v_existing
  from public.patient_registration_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_key_hash = v_request_key_hash
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_existing.state = 'completed' then
      return query
      select 'created'::text, p.id, p.patient_number, p.status, p.revision,
        p.created_at, p.updated_at, '[]'::jsonb
      from public.patient p
      where p.clinic_id = v_clinic_id and p.id = v_existing.patient_id;
      return;
    end if;
    if p_override_reason_code is null then
      return query select 'duplicate_warning'::text, null::uuid, null::text, null::text,
        null::integer, null::timestamptz, null::timestamptz, v_existing.duplicate_projection;
      return;
    end if;
    v_duplicates := v_existing.duplicate_projection;
    v_match_reason_codes := v_existing.match_reason_codes;
  else
    with candidates as (
      select r.patient_id, p.patient_number, r.full_name, r.email, r.date_of_birth,
        array_remove(array[
          case when r.phone = v_phone then 'PHONE_EXACT' end,
          case when v_email is not null and r.email = v_email then 'EMAIL_EXACT' end,
          case when r.normalised_name = v_normalised_name and r.date_of_birth = p_date_of_birth
            then 'NAME_DOB_EXACT' end
        ], null) as reason_codes
      from public.patient_registration r
      join public.patient p on p.clinic_id = r.clinic_id and p.id = r.patient_id
      where r.clinic_id = v_clinic_id
        and p.status = 'active'
        and (
          r.phone = v_phone
          or (v_email is not null and r.email = v_email)
          or (r.normalised_name = v_normalised_name and r.date_of_birth = p_date_of_birth)
        )
      order by r.patient_id
      limit 10
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'patientReference', c.patient_id,
        'maskedPatientNumber', 'GV-****' || right(c.patient_number, 2),
        'maskedName', left(c.full_name, 1) || repeat('•', greatest(char_length(c.full_name) - 1, 1)),
        'hasPhone', true,
        'hasEmail', c.email is not null,
        'birthYear', extract(year from c.date_of_birth)::integer,
        'matchReasonCodes', to_jsonb(c.reason_codes)
      ) order by c.patient_id), '[]'::jsonb),
      coalesce((
        select array_agg(distinct reason_code)
        from candidates c2 cross join lateral unnest(c2.reason_codes) reason_code
      ), '{}'::text[])
    into v_duplicates, v_match_reason_codes
    from candidates c;

    if jsonb_array_length(v_duplicates) > 0 and p_override_reason_code is null then
      perform set_config('graftvision.patient_controlled', 'on', true);
      insert into public.patient_registration_idempotency (
        clinic_id, actor_platform_user_id, request_key_hash, payload_hash,
        state, duplicate_projection, match_reason_codes
      ) values (
        v_clinic_id, p_provider_identity_id, v_request_key_hash, v_payload_hash,
        'warning', v_duplicates, v_match_reason_codes
      );
      insert into public.patient_duplicate_decision_history (
        clinic_id, request_key_hash, decision_code, match_reason_codes,
        actor_platform_user_id
      ) values (
        v_clinic_id, v_request_key_hash, 'warning', v_match_reason_codes,
        p_provider_identity_id
      );
      perform set_config('graftvision.patient_controlled', 'off', true);
      insert into public.audit_event (
        audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
        resource_type, outcome, reason_code, source_application, metadata
      ) values (
        'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.duplicate_warning',
        'patient', 'denied', 'DUPLICATE_MATCH', 'database', '{}'::jsonb
      );
      return query select 'duplicate_warning'::text, null::uuid, null::text, null::text,
        null::integer, null::timestamptz, null::timestamptz, v_duplicates;
      return;
    end if;
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
    id, clinic_id, patient_number, status, provenance_code, created_by, updated_by
  ) values (
    v_patient_id, v_clinic_id, v_patient_number, 'active', 'MANUAL_REGISTRATION',
    p_provider_identity_id, p_provider_identity_id
  );
  insert into public.patient_status_history (
    patient_id, clinic_id, previous_status, new_status, action_code,
    previous_revision, new_revision, provenance_code, actor_platform_user_id
  ) values (
    v_patient_id, v_clinic_id, null, 'active', 'created',
    0, 1, 'MANUAL_REGISTRATION', p_provider_identity_id
  );
  insert into public.patient_registration (
    patient_id, clinic_id, full_name, normalised_name, date_of_birth,
    phone, email, provenance_code, created_by, updated_by
  ) values (
    v_patient_id, v_clinic_id, v_display_name, v_normalised_name, p_date_of_birth,
    v_phone, v_email, p_provenance_code, p_provider_identity_id, p_provider_identity_id
  );
  insert into public.patient_registration_history (
    clinic_id, patient_id, registration_revision, action_code,
    provenance_code, actor_platform_user_id
  ) values (
    v_clinic_id, v_patient_id, 1, 'registration_created',
    p_provenance_code, p_provider_identity_id
  );
  if jsonb_array_length(v_duplicates) > 0 then
    insert into public.patient_duplicate_decision_history (
      clinic_id, patient_id, request_key_hash, decision_code, match_reason_codes,
      override_reason_code, actor_platform_user_id
    ) values (
      v_clinic_id, v_patient_id, v_request_key_hash, 'override', v_match_reason_codes,
      p_override_reason_code, p_provider_identity_id
    );
  end if;
  insert into public.patient_registration_idempotency (
    clinic_id, actor_platform_user_id, request_key_hash, payload_hash,
    state, patient_id, duplicate_projection, match_reason_codes, completed_at
  ) values (
    v_clinic_id, p_provider_identity_id, v_request_key_hash, v_payload_hash,
    'completed', v_patient_id, v_duplicates, v_match_reason_codes, clock_timestamp()
  )
  on conflict (clinic_id, actor_platform_user_id, request_key_hash)
  do update set state = 'completed', patient_id = excluded.patient_id,
    completed_at = excluded.completed_at;
  perform set_config('graftvision.patient_controlled', 'off', true);

  if jsonb_array_length(v_duplicates) > 0 then
    insert into public.audit_event (
      audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
      resource_type, resource_id, outcome, reason_code, source_application, metadata
    ) values (
      'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.duplicate_override',
      'patient', v_patient_id, 'success', p_override_reason_code, 'database', '{}'::jsonb
    );
  end if;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.registration_create',
    'patient', v_patient_id, 'success', p_provenance_code, 'database', '{}'::jsonb
  );
  return query
  select 'created'::text, p.id, p.patient_number, p.status, p.revision,
    p.created_at, p.updated_at, '[]'::jsonb
  from public.patient p where p.id = v_patient_id;
end;
$$;

revoke all on function graftvision_private.register_patient(
  uuid, uuid, uuid, text, date, text, text, text, text
) from public, anon, authenticated;
