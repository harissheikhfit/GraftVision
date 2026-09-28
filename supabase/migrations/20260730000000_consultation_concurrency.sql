-- GraftVision migration
-- Task: CONSULT-005
-- Purpose: Add privacy-safe optimistic-concurrency results and conflict audit evidence.
-- Created UTC: 20260730000000
-- Category: additive functions and controlled audit allowlist extensions
-- Compatibility: Additive only; historical consultation functions and tables remain unchanged.
-- Transaction and locks: Function catalogue changes only; no table rewrite is required.
-- Tenant and RLS impact: Reuses the existing database-authoritative consultation operations.
-- Data impact: No production or fixture data is inserted.
-- Verification: Static policy checks plus transactional pgTAP concurrency tests.
-- Corrective plan: Forward-fix with a later reviewed migration.

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
    'clinic.settings_view', 'clinic.suspend', 'consultation.concurrency_conflict',
    'consultation.create', 'consultation.doctor_assign', 'consultation.doctor_reassign',
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

create or replace function graftvision_private.is_valid_audit_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_key text;
  metadata_value jsonb;
begin
  if candidate is null
    or jsonb_typeof(candidate) <> 'object'
    or octet_length(convert_to(candidate::text, 'UTF8')) > 2048 then
    return false;
  end if;

  for metadata_key, metadata_value in
    select key, value from jsonb_each(candidate)
  loop
    case metadata_key
      when 'affected_count', 'current_revision', 'expected_revision', 'new_version' then
        if jsonb_typeof(metadata_value) <> 'number'
          or metadata_value::text !~ '^[0-9]{1,7}$'
          or metadata_value::text::bigint > 1000000 then
          return false;
        end if;
      when 'changed_fields' then
        if jsonb_typeof(metadata_value) <> 'array'
          or jsonb_array_length(metadata_value) > 32
          or exists (
            select 1
            from jsonb_array_elements(metadata_value) as item(value)
            where jsonb_typeof(item.value) <> 'string'
              or item.value #>> '{}' !~ '^[a-z][a-z0-9_]{0,62}$'
          ) then
          return false;
        end if;
      when 'assigned_role', 'device_label', 'error_code', 'new_status',
           'operation_code', 'outcome_code', 'policy_decision_code',
           'previous_status', 'removed_role', 'reason_code', 'route_family',
           'storage_object_class' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create function graftvision_private.transition_consultation_status_with_concurrency(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_consultation_id uuid,
  p_expected_revision integer,
  p_new_status text,
  p_reason_code text,
  p_idempotency_key uuid
)
returns table (
  outcome_code text,
  consultation_id uuid,
  doctor_platform_user_id uuid,
  status text,
  revision integer,
  updated_at timestamptz,
  changed_fields text[],
  operation_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_clinic_id uuid;
  v_current public.consultation%rowtype;
  v_result_revision integer;
begin
  begin
    select * into strict v_result
    from graftvision_private.transition_consultation_status(
      p_session_id, p_provider_identity_id, p_consultation_id, p_expected_revision,
      p_new_status, p_reason_code, p_idempotency_key
    );
  exception
    when sqlstate '40001' then
      select s.clinic_id into strict v_clinic_id
      from public.application_session s
      where s.id = p_session_id
        and s.platform_user_id = p_provider_identity_id
        and s.authority_scope = 'clinic';
      select * into strict v_current
      from public.consultation c
      where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
      insert into public.audit_event (
        audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
        resource_type, resource_id, outcome, reason_code, request_id,
        source_application, metadata
      ) values (
        'clinic', v_clinic_id, p_provider_identity_id, 'user',
        'consultation.concurrency_conflict', 'consultation', p_consultation_id,
        'failure', 'STALE_REVISION', p_idempotency_key, 'database',
        jsonb_build_object(
          'operation_code', 'status_transition',
          'expected_revision', p_expected_revision,
          'current_revision', v_current.revision,
          'outcome_code', 'stale_revision',
          'changed_fields', jsonb_build_array('status', 'consultation_revision')
        )
      );
      return query select
        'stale_revision'::text, v_current.id, null::uuid, v_current.status,
        v_current.revision, v_current.updated_at,
        array['status', 'consultation_revision']::text[], 'status_transition'::text;
      return;
  end;

  select s.clinic_id into strict v_clinic_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id;
  select i.result_revision into strict v_result_revision
  from public.consultation_operation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'consultation.status_change'
    and i.idempotency_key = p_idempotency_key;
  select c.updated_at into strict v_current.updated_at
  from public.consultation c where c.id = v_result.consultation_id;
  return query select
    'success'::text, v_result.consultation_id, null::uuid, p_new_status,
    v_result_revision, v_current.updated_at,
    array['status', 'consultation_revision']::text[], 'status_transition'::text;
end;
$$;
revoke all on function graftvision_private.transition_consultation_status_with_concurrency(
  uuid, uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated;

create function graftvision_private.assign_consultation_doctor_with_concurrency(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_consultation_id uuid,
  p_doctor_platform_user_id uuid,
  p_expected_revision integer,
  p_reason_code text,
  p_idempotency_key uuid
)
returns table (
  outcome_code text,
  consultation_id uuid,
  doctor_platform_user_id uuid,
  status text,
  revision integer,
  updated_at timestamptz,
  changed_fields text[],
  operation_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_clinic_id uuid;
  v_current public.consultation%rowtype;
  v_result_revision integer;
begin
  begin
    select * into strict v_result
    from graftvision_private.assign_consultation_doctor(
      p_session_id, p_provider_identity_id, p_consultation_id,
      p_doctor_platform_user_id, p_expected_revision, p_reason_code, p_idempotency_key
    );
  exception
    when sqlstate '40001' then
      select s.clinic_id into strict v_clinic_id
      from public.application_session s
      where s.id = p_session_id
        and s.platform_user_id = p_provider_identity_id
        and s.authority_scope = 'clinic';
      select * into strict v_current
      from public.consultation c
      where c.clinic_id = v_clinic_id and c.id = p_consultation_id;
      insert into public.audit_event (
        audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
        resource_type, resource_id, outcome, reason_code, request_id,
        source_application, metadata
      ) values (
        'clinic', v_clinic_id, p_provider_identity_id, 'user',
        'consultation.concurrency_conflict', 'consultation', p_consultation_id,
        'failure', 'STALE_REVISION', p_idempotency_key, 'database',
        jsonb_build_object(
          'operation_code', 'doctor_assignment',
          'expected_revision', p_expected_revision,
          'current_revision', v_current.revision,
          'outcome_code', 'stale_revision',
          'changed_fields', jsonb_build_array('assigned_doctor', 'consultation_revision')
        )
      );
      return query select
        'stale_revision'::text, v_current.id, null::uuid, v_current.status,
        v_current.revision, v_current.updated_at,
        array['assigned_doctor', 'consultation_revision']::text[],
        'doctor_assignment'::text;
      return;
  end;

  select s.clinic_id into strict v_clinic_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id;
  select i.result_revision into strict v_result_revision
  from public.consultation_operation_idempotency i
  where i.clinic_id = v_clinic_id
    and i.actor_platform_user_id = p_provider_identity_id
    and i.request_family = 'consultation.doctor_assign'
    and i.idempotency_key = p_idempotency_key;
  select c.status, c.updated_at into strict v_current.status, v_current.updated_at
  from public.consultation c where c.id = v_result.consultation_id;
  return query select
    'success'::text, v_result.consultation_id, v_result.doctor_platform_user_id,
    v_current.status, v_result_revision, v_current.updated_at,
    array['assigned_doctor', 'consultation_revision']::text[],
    'doctor_assignment'::text;
end;
$$;
revoke all on function graftvision_private.assign_consultation_doctor_with_concurrency(
  uuid, uuid, uuid, uuid, integer, text, uuid
) from public, anon, authenticated;
