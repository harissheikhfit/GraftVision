-- AI-MAP-001 corrective migration: restore session access and read contract.
create function graftvision_private.require_active_application_session(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (clinic_id uuid, actor_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.application_session%rowtype;
begin
  select * into v_session
  from public.application_session
  where id = p_session_id
    and platform_user_id = p_provider_identity_id;

  if not found
     or not graftvision_private.validate_application_session(p_session_id)
     or v_session.authority_scope <> 'clinic'
     or v_session.clinic_id is null then
    raise exception using errcode = '42501', message = 'APPLICATION_SESSION_DENIED';
  end if;

  return query select v_session.clinic_id, v_session.platform_user_id;
end;
$$;
revoke all on function graftvision_private.require_active_application_session(uuid, uuid) from public, anon, authenticated;

create or replace function graftvision_private.read_ai_map_proposal_package(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_proposal_package_id uuid
)
returns table (
  proposal_id uuid,
  clinic_id uuid,
  patient_id uuid,
  consultation_id uuid,
  scan_session_id uuid,
  package_state text,
  overall_confidence numeric,
  quality_state text,
  proposal_package_version text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_package public.ai_map_proposal_package%rowtype;
begin
  select * into strict v_context
  from graftvision_private.require_active_application_session(p_session_id, p_provider_identity_id);

  select * into strict v_package
  from public.ai_map_proposal_package
  where id = p_proposal_package_id
    and clinic_id = v_context.clinic_id;

  if not graftvision_private.is_assigned_verified_doctor(
    p_session_id,
    p_provider_identity_id,
    v_package.consultation_id,
    'CONSULT-PERM-001'
  ) then
    raise exception using errcode = '42501', message = 'AI_MAP_READ_DENIED';
  end if;

  return query select
    v_package.id,
    v_package.clinic_id,
    v_package.patient_id,
    v_package.consultation_id,
    v_package.scan_session_id,
    v_package.package_state,
    v_package.overall_confidence,
    v_package.quality_state,
    v_package.proposal_package_version,
    v_package.created_at,
    v_package.started_at,
    v_package.completed_at;
end;
$$;
revoke all on function graftvision_private.read_ai_map_proposal_package(uuid, uuid, uuid) from public, anon, authenticated;

-- Keep the existing operation bodies aligned with the restored helper contract.
-- graftvision:dangerous-sql-approved task=AI-MAP-001
-- graftvision:dangerous-sql-reason Existing operations require the same active clinic session boundary.
-- graftvision:corrective-plan Forward-fix via additive migration.
