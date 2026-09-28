-- GraftVision migration
-- Task: PATIENT-005
-- Purpose: Add registration/privacy notice acknowledgement without treatment consent.
-- Created UTC: 20260729000002
-- Compatibility: Additive only; the 13-role/58-permission catalogues remain unchanged.
-- Privacy: Synthetic data only. Production use remains blocked pending qualified Pakistan legal/privacy approval.
-- graftvision:dangerous-sql-approved task=PATIENT-005
-- graftvision:dangerous-sql-reason Reviewed controlled privacy acknowledgement, withdrawal, immutable history, RLS, idempotency, and audit actions.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create table public.privacy_notice_version (
  notice_version_id uuid primary key default gen_random_uuid(),
  notice_pair_id uuid not null,
  purpose_code text not null check (purpose_code = 'REGISTRATION_PRIVACY'),
  semantic_version text not null check (
    semantic_version ~ '^[1-9][0-9]{0,5}\.[0-9]{1,6}$'
  ),
  language text not null check (language in ('en', 'ur')),
  content_reference text not null check (
    char_length(content_reference) between 8 and 240
    and content_reference ~ '^notice://registration-privacy/[a-z0-9._/-]+$'
  ),
  content_hash bytea not null check (octet_length(content_hash) = 32),
  effective_date date not null,
  state text not null default 'approved' check (state in ('approved', 'superseded')),
  superseded_at timestamptz,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint privacy_notice_supersession_check check (
    (state = 'approved' and superseded_at is null)
    or (state = 'superseded' and superseded_at is not null)
  ),
  unique (notice_pair_id, language),
  unique (purpose_code, semantic_version, language)
);

create table public.patient_privacy_acknowledgement (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  notice_version_id uuid not null references public.privacy_notice_version(notice_version_id)
    on update restrict on delete restrict,
  purpose_code text not null check (purpose_code = 'REGISTRATION_PRIVACY'),
  language_presented text not null check (language_presented in ('en', 'ur')),
  status text not null check (status in ('pending', 'acknowledged', 'withdrawn', 'superseded')),
  actor_platform_user_id uuid not null references public.platform_user(id)
    on update restrict on delete restrict,
  channel text not null check (channel in ('IN_PERSON_CLINIC', 'REMOTE_VERIFIED')),
  occurred_at timestamptz not null,
  withdrawal_at timestamptz,
  withdrawal_reason_code text check (
    withdrawal_reason_code is null
    or withdrawal_reason_code in ('PATIENT_REQUEST', 'VERIFIED_REPRESENTATIVE_REQUEST')
  ),
  representative_type text check (
    representative_type is null
    or representative_type in ('PARENT', 'GUARDIAN', 'AUTHORISED_REPRESENTATIVE')
  ),
  representative_reference uuid,
  revision integer not null default 1 check (revision >= 1),
  provenance_code text not null check (provenance_code = 'CLINIC_RECORDED'),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_by uuid not null references public.platform_user(id)
    on update restrict on delete restrict,
  constraint patient_privacy_ack_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict,
  constraint patient_privacy_ack_withdrawal_check check (
    (status = 'withdrawn' and withdrawal_at is not null and withdrawal_reason_code is not null)
    or (status <> 'withdrawn' and withdrawal_at is null and withdrawal_reason_code is null)
  ),
  constraint patient_privacy_ack_representative_check check (
    (representative_type is null and representative_reference is null)
    or (representative_type is not null and representative_reference is not null)
  ),
  unique (clinic_id, patient_id, purpose_code)
);

create table public.patient_privacy_acknowledgement_history (
  id uuid primary key default gen_random_uuid(),
  acknowledgement_id uuid not null,
  clinic_id uuid not null,
  patient_id uuid not null,
  notice_version_id uuid not null references public.privacy_notice_version(notice_version_id)
    on update restrict on delete restrict,
  purpose_code text not null check (purpose_code = 'REGISTRATION_PRIVACY'),
  language_presented text not null check (language_presented in ('en', 'ur')),
  previous_status text check (
    previous_status is null or previous_status in ('pending', 'acknowledged', 'withdrawn', 'superseded')
  ),
  new_status text not null check (
    new_status in ('pending', 'acknowledged', 'withdrawn', 'superseded')
  ),
  revision integer not null check (revision >= 1),
  channel text not null check (channel in ('IN_PERSON_CLINIC', 'REMOTE_VERIFIED')),
  reason_code text not null check (
    reason_code in ('NOTICE_ACKNOWLEDGED', 'PATIENT_REQUEST', 'NOTICE_SUPERSEDED')
  ),
  actor_platform_user_id uuid not null references public.platform_user(id)
    on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  provenance_code text not null check (provenance_code = 'CLINIC_RECORDED'),
  constraint patient_privacy_ack_history_patient_fk
    foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
    on update restrict on delete restrict
);

create table public.patient_privacy_acknowledgement_idempotency (
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  actor_platform_user_id uuid not null references public.platform_user(id)
    on update restrict on delete restrict,
  request_key_hash bytea not null check (octet_length(request_key_hash) = 32),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  acknowledgement_id uuid not null,
  resulting_revision integer not null check (resulting_revision >= 1),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_key_hash)
);

create index patient_privacy_ack_patient_idx
  on public.patient_privacy_acknowledgement (clinic_id, patient_id);
create index patient_privacy_ack_history_idx
  on public.patient_privacy_acknowledgement_history (clinic_id, patient_id, occurred_at desc);

alter table public.privacy_notice_version enable row level security;
alter table public.privacy_notice_version force row level security;
alter table public.patient_privacy_acknowledgement enable row level security;
alter table public.patient_privacy_acknowledgement force row level security;
alter table public.patient_privacy_acknowledgement_history enable row level security;
alter table public.patient_privacy_acknowledgement_history force row level security;
alter table public.patient_privacy_acknowledgement_idempotency enable row level security;
alter table public.patient_privacy_acknowledgement_idempotency force row level security;

revoke all on table public.privacy_notice_version from public, anon, authenticated;
revoke all on table public.patient_privacy_acknowledgement from public, anon, authenticated;
revoke all on table public.patient_privacy_acknowledgement_history from public, anon, authenticated;
revoke all on table public.patient_privacy_acknowledgement_idempotency from public, anon, authenticated;

create function graftvision_private.enforce_privacy_notice_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('graftvision.privacy_notice_controlled', true) <> 'on' then
    raise exception using errcode = '42501', message = 'PRIVACY_NOTICE_DIRECT_MUTATION_DENIED';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function graftvision_private.enforce_privacy_notice_control()
  from public, anon, authenticated;

create trigger privacy_notice_controlled
before insert or update or delete on public.privacy_notice_version
for each row execute function graftvision_private.enforce_privacy_notice_control();
create trigger patient_privacy_ack_controlled
before insert or update or delete on public.patient_privacy_acknowledgement
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_privacy_ack_history_controlled
before insert on public.patient_privacy_acknowledgement_history
for each row execute function graftvision_private.enforce_controlled_patient_mutation();
create trigger patient_privacy_ack_history_immutable
before update or delete on public.patient_privacy_acknowledgement_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();
create trigger patient_privacy_ack_idempotency_controlled
before insert or update or delete on public.patient_privacy_acknowledgement_idempotency
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
    'patient.duplicate_override', 'patient.duplicate_warning', 'patient.privacy_acknowledge',
    'patient.privacy_withdraw', 'patient.registration_create', 'patient.status_change',
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
    'patient', 'patient_privacy_acknowledgement', 'platform_user',
    'platform_user_role', 'storage_object_key', 'system'
  );
$$;

create function graftvision_private.read_patient_privacy_acknowledgement(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_result jsonb;
begin
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  if not exists (
    select 1 from public.patient p
    where p.id = p_patient_id and p.clinic_id = v_clinic_id and p.status = 'active'
  ) then return null; end if;

  select jsonb_build_object(
    'current', case when a.id is null then null else jsonb_build_object(
      'id', a.id, 'noticeVersionId', a.notice_version_id,
      'purposeCode', a.purpose_code, 'languagePresented', a.language_presented,
      'status', a.status, 'occurredAt', a.occurred_at,
      'withdrawalAt', a.withdrawal_at, 'revision', a.revision
    ) end,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'noticeVersionId', n.notice_version_id, 'noticePairId', n.notice_pair_id,
        'semanticVersion', n.semantic_version, 'purposeCode', n.purpose_code,
        'language', n.language, 'contentReference', n.content_reference,
        'effectiveDate', n.effective_date, 'state', n.state
      ) order by n.language)
      from public.privacy_notice_version n
      where n.purpose_code = 'REGISTRATION_PRIVACY'
        and n.state = 'approved' and n.effective_date <= current_date
        and exists (
          select 1 from public.privacy_notice_version pair
          where pair.notice_pair_id = n.notice_pair_id
            and pair.semantic_version = n.semantic_version
            and pair.purpose_code = n.purpose_code
            and pair.state = 'approved'
          group by pair.notice_pair_id
          having count(*) = 2 and count(distinct pair.language) = 2
        )
    ), '[]'::jsonb)
  ) into v_result
  from (select 1) seed
  left join public.patient_privacy_acknowledgement a
    on a.clinic_id = v_clinic_id and a.patient_id = p_patient_id
      and a.purpose_code = 'REGISTRATION_PRIVACY';
  return v_result;
end;
$$;

revoke all on function graftvision_private.read_patient_privacy_acknowledgement(uuid, uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.record_patient_privacy_acknowledgement(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_notice_version_id uuid,
  p_language text,
  p_channel text,
  p_idempotency_key uuid,
  p_expected_revision integer default 0,
  p_representative_type text default null,
  p_representative_reference uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_pair_id uuid;
  v_semantic_version text;
  v_ack public.patient_privacy_acknowledgement%rowtype;
  v_request_hash bytea;
  v_payload_hash bytea;
  v_existing record;
  v_now timestamptz := clock_timestamp();
  v_had_ack boolean := false;
  v_previous_status text;
  v_notice_changed boolean := false;
begin
  if p_language not in ('en', 'ur')
    or p_channel not in ('IN_PERSON_CLINIC', 'REMOTE_VERIFIED')
    or p_idempotency_key is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'INVALID_PRIVACY_ACKNOWLEDGEMENT';
  end if;
  if p_representative_type is not null or p_representative_reference is not null then
    raise exception using errcode = '42501', message = 'REPRESENTATIVE_AUTHORITY_NOT_VERIFIED';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  if not exists (
    select 1 from public.patient p
    where p.id = p_patient_id and p.clinic_id = v_clinic_id and p.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'PATIENT_CONTEXT_DENIED';
  end if;
  select n.notice_pair_id, n.semantic_version into v_pair_id, v_semantic_version
  from public.privacy_notice_version n
  where n.notice_version_id = p_notice_version_id
    and n.purpose_code = 'REGISTRATION_PRIVACY' and n.language = p_language
    and n.state = 'approved' and n.effective_date <= current_date;
  if v_pair_id is null or (
    select count(*) from public.privacy_notice_version n
    where n.notice_pair_id = v_pair_id and n.semantic_version = v_semantic_version
      and n.purpose_code = 'REGISTRATION_PRIVACY' and n.state = 'approved'
      and n.language in ('en', 'ur')
  ) <> 2 then
    raise exception using errcode = '22023', message = 'NOTICE_PARITY_REQUIRED';
  end if;

  v_request_hash := extensions.digest(p_idempotency_key::text, 'sha256');
  v_payload_hash := extensions.digest(
    p_patient_id::text || ':' || p_notice_version_id::text || ':' || p_language || ':' || p_channel,
    'sha256'
  );
  select i.payload_hash, i.acknowledgement_id into v_existing
  from public.patient_privacy_acknowledgement_idempotency i
  where i.clinic_id = v_clinic_id and i.actor_platform_user_id = p_provider_identity_id
    and i.request_key_hash = v_request_hash
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into v_ack from public.patient_privacy_acknowledgement
    where id = v_existing.acknowledgement_id;
    return jsonb_build_object('id', v_ack.id, 'status', v_ack.status,
      'revision', v_ack.revision, 'noticeVersionId', v_ack.notice_version_id);
  end if;

  select * into v_ack from public.patient_privacy_acknowledgement
  where clinic_id = v_clinic_id and patient_id = p_patient_id
    and purpose_code = 'REGISTRATION_PRIVACY'
  for update;
  v_had_ack := found;
  v_previous_status := v_ack.status;
  v_notice_changed := v_had_ack and v_ack.notice_version_id <> p_notice_version_id;
  if v_had_ack and v_ack.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PRIVACY_ACKNOWLEDGEMENT_CONFLICT';
  end if;

  perform set_config('graftvision.patient_controlled', 'on', true);
  if v_had_ack then
    if v_notice_changed then
      insert into public.patient_privacy_acknowledgement_history (
        acknowledgement_id, clinic_id, patient_id, notice_version_id, purpose_code,
        language_presented, previous_status, new_status, revision, channel,
        reason_code, actor_platform_user_id, occurred_at, provenance_code
      ) values (
        v_ack.id, v_clinic_id, p_patient_id, v_ack.notice_version_id,
        'REGISTRATION_PRIVACY', v_ack.language_presented, v_ack.status, 'superseded',
        v_ack.revision, v_ack.channel, 'NOTICE_SUPERSEDED', p_provider_identity_id,
        v_now, 'CLINIC_RECORDED'
      );
    end if;
    update public.patient_privacy_acknowledgement
    set notice_version_id = p_notice_version_id, language_presented = p_language,
      status = 'acknowledged', actor_platform_user_id = p_provider_identity_id,
      channel = p_channel, occurred_at = v_now, withdrawal_at = null,
      withdrawal_reason_code = null, representative_type = null,
      representative_reference = null, revision = revision + 1,
      updated_at = v_now, updated_by = p_provider_identity_id
    where id = v_ack.id returning * into v_ack;
  else
    insert into public.patient_privacy_acknowledgement (
      clinic_id, patient_id, notice_version_id, purpose_code, language_presented,
      status, actor_platform_user_id, channel, occurred_at, provenance_code, updated_by
    ) values (
      v_clinic_id, p_patient_id, p_notice_version_id, 'REGISTRATION_PRIVACY', p_language,
      'acknowledged', p_provider_identity_id, p_channel, v_now, 'CLINIC_RECORDED',
      p_provider_identity_id
    ) returning * into v_ack;
  end if;
  insert into public.patient_privacy_acknowledgement_history (
    acknowledgement_id, clinic_id, patient_id, notice_version_id, purpose_code,
    language_presented, previous_status, new_status, revision, channel,
    reason_code, actor_platform_user_id, occurred_at, provenance_code
  ) values (
    v_ack.id, v_clinic_id, p_patient_id, p_notice_version_id, 'REGISTRATION_PRIVACY',
    p_language, case when v_notice_changed then 'superseded' else v_previous_status end,
    'acknowledged', v_ack.revision, p_channel, 'NOTICE_ACKNOWLEDGED',
    p_provider_identity_id, v_now, 'CLINIC_RECORDED'
  );
  insert into public.patient_privacy_acknowledgement_idempotency (
    clinic_id, actor_platform_user_id, request_key_hash, payload_hash,
    acknowledgement_id, resulting_revision
  ) values (
    v_clinic_id, p_provider_identity_id, v_request_hash, v_payload_hash,
    v_ack.id, v_ack.revision
  );
  perform set_config('graftvision.patient_controlled', 'off', true);
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.privacy_acknowledge',
    'patient_privacy_acknowledgement', v_ack.id, 'success', 'NOTICE_ACKNOWLEDGED',
    'database', jsonb_build_object('new_status', 'acknowledged',
      'policy_decision_code', 'REGISTRATION_PRIVACY:' || v_semantic_version)
  );
  return jsonb_build_object('id', v_ack.id, 'status', v_ack.status,
    'revision', v_ack.revision, 'noticeVersionId', v_ack.notice_version_id);
end;
$$;

revoke all on function graftvision_private.record_patient_privacy_acknowledgement(
  uuid, uuid, uuid, uuid, text, text, uuid, integer, text, uuid
) from public, anon, authenticated;

create function graftvision_private.withdraw_patient_privacy_acknowledgement(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_expected_revision integer,
  p_reason_code text,
  p_idempotency_key uuid,
  p_representative_type text default null,
  p_representative_reference uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_ack public.patient_privacy_acknowledgement%rowtype;
  v_request_hash bytea;
  v_payload_hash bytea;
  v_existing record;
  v_now timestamptz := clock_timestamp();
  v_semantic_version text;
begin
  if p_reason_code <> 'PATIENT_REQUEST' or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_WITHDRAWAL_REASON';
  end if;
  if p_representative_type is not null or p_representative_reference is not null then
    raise exception using errcode = '42501', message = 'REPRESENTATIVE_AUTHORITY_NOT_VERIFIED';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  v_request_hash := extensions.digest(p_idempotency_key::text, 'sha256');
  v_payload_hash := extensions.digest(
    p_patient_id::text || ':withdraw:' || p_reason_code || ':' || p_expected_revision::text,
    'sha256'
  );
  select i.payload_hash, i.acknowledgement_id into v_existing
  from public.patient_privacy_acknowledgement_idempotency i
  where i.clinic_id = v_clinic_id and i.actor_platform_user_id = p_provider_identity_id
    and i.request_key_hash = v_request_hash
  for update;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into v_ack from public.patient_privacy_acknowledgement
    where id = v_existing.acknowledgement_id;
    return jsonb_build_object('id', v_ack.id, 'status', v_ack.status,
      'revision', v_ack.revision, 'noticeVersionId', v_ack.notice_version_id);
  end if;
  select * into v_ack from public.patient_privacy_acknowledgement
  where clinic_id = v_clinic_id and patient_id = p_patient_id
    and purpose_code = 'REGISTRATION_PRIVACY'
  for update;
  if not found then raise exception using errcode = '22023', message = 'ACKNOWLEDGEMENT_NOT_FOUND'; end if;
  if v_ack.status <> 'acknowledged' then
    raise exception using errcode = '22023', message = 'ACKNOWLEDGEMENT_NOT_ACTIVE';
  end if;
  if v_ack.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PRIVACY_ACKNOWLEDGEMENT_CONFLICT';
  end if;
  select n.semantic_version into v_semantic_version
  from public.privacy_notice_version n
  where n.notice_version_id = v_ack.notice_version_id;
  perform set_config('graftvision.patient_controlled', 'on', true);
  update public.patient_privacy_acknowledgement
  set status = 'withdrawn', withdrawal_at = v_now,
    withdrawal_reason_code = p_reason_code, revision = revision + 1,
    updated_at = v_now, updated_by = p_provider_identity_id
  where id = v_ack.id returning * into v_ack;
  insert into public.patient_privacy_acknowledgement_history (
    acknowledgement_id, clinic_id, patient_id, notice_version_id, purpose_code,
    language_presented, previous_status, new_status, revision, channel,
    reason_code, actor_platform_user_id, occurred_at, provenance_code
  ) values (
    v_ack.id, v_clinic_id, p_patient_id, v_ack.notice_version_id,
    'REGISTRATION_PRIVACY', v_ack.language_presented, 'acknowledged', 'withdrawn',
    v_ack.revision, v_ack.channel, p_reason_code, p_provider_identity_id,
    v_now, 'CLINIC_RECORDED'
  );
  insert into public.patient_privacy_acknowledgement_idempotency (
    clinic_id, actor_platform_user_id, request_key_hash, payload_hash,
    acknowledgement_id, resulting_revision
  ) values (
    v_clinic_id, p_provider_identity_id, v_request_hash, v_payload_hash,
    v_ack.id, v_ack.revision
  );
  perform set_config('graftvision.patient_controlled', 'off', true);
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'patient.privacy_withdraw',
    'patient_privacy_acknowledgement', v_ack.id, 'success', p_reason_code,
    'database', jsonb_build_object('new_status', 'withdrawn',
      'policy_decision_code', 'REGISTRATION_PRIVACY:' || v_semantic_version)
  );
  return jsonb_build_object('id', v_ack.id, 'status', v_ack.status,
    'revision', v_ack.revision, 'noticeVersionId', v_ack.notice_version_id);
end;
$$;

revoke all on function graftvision_private.withdraw_patient_privacy_acknowledgement(
  uuid, uuid, uuid, integer, text, uuid, text, uuid
) from public, anon, authenticated;
