-- Migration: SCAN-002 QR-token redemption and safe status projection.
-- The raw pairing secret remains at the application boundary; only its HMAC is passed here.

create or replace function graftvision_private.create_scan_session(
  p_session_id uuid, p_provider_identity_id uuid, p_id uuid, p_patient_id uuid,
  p_consultation_id uuid, p_token_hash text, p_expires_at timestamptz, p_idempotency_key text
)
returns table (scan_session_id uuid, revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic_id uuid;
  v_actor_id uuid;
  v_existing public.scan_operation_idempotency%rowtype;
begin
  select s.clinic_id, s.platform_user_id into strict v_clinic_id, v_actor_id
  from public.application_session s
  where s.id = p_session_id and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';
  if p_token_hash is null
    or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or not graftvision_private.has_application_session_permission(
      p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'CLINICAL-PERM-002'
    )
    or not exists (
      select 1 from public.consultation_assignment ca
      join public.clinic_membership m on m.clinic_id = ca.clinic_id and m.platform_user_id = v_actor_id
      join public.clinic_membership_role mr on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
      join public.doctor_verification dv on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
      where ca.consultation_id = p_consultation_id and ca.clinic_id = v_clinic_id
        and ca.doctor_platform_user_id = v_actor_id and m.membership_status = 'active'
        and dv.status = 'verified' and dv.expires_at > clock_timestamp()
    )
  then raise exception using errcode = '42501', message = 'SCAN_SESSION_CREATE_DENIED'; end if;
  select * into v_existing from public.scan_operation_idempotency
  where clinic_id = v_clinic_id and actor_platform_user_id = v_actor_id
    and request_family = 'scan_session.create' and idempotency_key = p_idempotency_key;
  if found then return query select v_existing.scan_session_id, v_existing.result_revision, false; return; end if;
  if not exists (
    select 1 from graftvision_private.read_consultation_analyzer_readiness(v_clinic_id, p_consultation_id) where is_ready
  ) or not exists (
    select 1 from public.patient p where p.id = p_patient_id and p.clinic_id = v_clinic_id and p.lifecycle_state = 'current'
  ) then raise exception using errcode = '42501', message = 'CONSULTATION_ANALYZER_NOT_READY'; end if;
  perform set_config('graftvision.scan_controlled', 'on', true);
  insert into public.scan_session (id, clinic_id, patient_id, consultation_id, created_by, status, token_hash, expires_at)
  values (p_id, v_clinic_id, p_patient_id, p_consultation_id, v_actor_id, 'created', p_token_hash, p_expires_at);
  insert into public.scan_session_event (scan_session_id, clinic_id, event_type, actor_platform_user_id)
  values (p_id, v_clinic_id, 'created', v_actor_id);
  insert into public.audit_event (audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type, resource_id, outcome, request_id, source_application)
  values ('clinic', v_clinic_id, v_actor_id, 'user', 'scan_session.create', 'scan_session', p_id, 'success', p_idempotency_key::uuid, 'database');
  insert into public.scan_operation_idempotency (clinic_id, actor_platform_user_id, request_family, idempotency_key, scan_session_id, result_revision)
  values (v_clinic_id, v_actor_id, 'scan_session.create', p_idempotency_key, p_id, 1);
  perform set_config('graftvision.scan_controlled', 'off', true);
  return query select p_id, 1, true;
end;
$$;
revoke all on function graftvision_private.create_scan_session(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text)
  from public, anon, authenticated;

create or replace function graftvision_private.redeem_scan_session_token(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_token_hash text,
  p_pairing_nonce text,
  p_idempotency_key text
)
returns table (scan_session_id uuid, revision integer, status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_scan_session_id uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) < 32
    or p_pairing_nonce is null or char_length(p_pairing_nonce) < 32
    or p_idempotency_key is null or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception using errcode = '42501', message = 'SCAN_PAIRING_DENIED';
  end if;

  select id into v_scan_session_id
  from public.scan_session
  where token_hash = p_token_hash;

  if not found then
    raise exception using errcode = '42501', message = 'SCAN_PAIRING_DENIED';
  end if;

  return query select * from graftvision_private.pair_scan_session(
    p_session_id, p_provider_identity_id, v_scan_session_id, p_pairing_nonce, p_idempotency_key
  );
end;
$$;
revoke all on function graftvision_private.redeem_scan_session_token(uuid, uuid, text, text, text)
  from public, anon, authenticated;

create or replace function graftvision_private.read_scan_session_status(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_scan_session_id uuid
)
returns table (scan_session_id uuid, status text, revision integer, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic_id uuid;
begin
  select s.clinic_id into v_clinic_id
  from public.application_session s
  where s.id = p_session_id
    and s.platform_user_id = p_provider_identity_id
    and s.authority_scope = 'clinic';

  if v_clinic_id is null
    or not graftvision_private.has_application_session_permission(
      p_session_id, p_provider_identity_id, 'clinic', v_clinic_id, 'CLINICAL-PERM-002'
    )
    or not exists (
      select 1 from public.clinic_membership m
      join public.clinic_membership_role mr on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
      join public.doctor_verification dv on dv.clinic_id = m.clinic_id and dv.platform_user_id = m.platform_user_id
      where m.clinic_id = v_clinic_id and m.platform_user_id = p_provider_identity_id
        and m.membership_status = 'active' and dv.status = 'verified' and dv.expires_at > clock_timestamp()
    )
  then
    raise exception using errcode = '42501', message = 'SCAN_STATUS_DENIED';
  end if;

  return query
  select ss.id, ss.status, ss.revision, ss.expires_at
  from public.scan_session ss
  join public.patient p on p.id = ss.patient_id and p.clinic_id = ss.clinic_id
  where ss.id = p_scan_session_id
    and ss.clinic_id = v_clinic_id
    and p.lifecycle_state = 'current';
end;
$$;
revoke all on function graftvision_private.read_scan_session_status(uuid, uuid, uuid)
  from public, anon, authenticated;
