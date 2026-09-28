-- SCAN-005 corrective migration: authorize handoff against completed consultation evidence.
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Analyzer readiness requires completed consultations while the general clinical context excludes them.
-- graftvision:corrective-plan Add a scan-scoped authorization helper; preserve tenant, role, verification, and permission checks.

create or replace function graftvision_private.is_assigned_verified_scan_doctor(
  p_session_id uuid,
  p_actor_id uuid,
  p_consultation_id uuid,
  p_permission_id text
)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.consultation c
    join public.patient p on p.clinic_id = c.clinic_id and p.id = c.patient_id
    join public.application_session s
      on s.id = p_session_id
      and s.platform_user_id = p_actor_id
      and s.authority_scope = 'clinic'
      and s.clinic_id = c.clinic_id
    join public.consultation_assignment ca
      on ca.clinic_id = c.clinic_id
      and ca.consultation_id = c.id
      and ca.doctor_platform_user_id = p_actor_id
    join public.clinic_membership m
      on m.clinic_id = c.clinic_id
      and m.platform_user_id = p_actor_id
    join public.clinic_membership_role mr
      on mr.clinic_membership_id = m.id
      and mr.role_code = 'DOCTOR'
    join public.doctor_verification dv
      on dv.clinic_id = c.clinic_id
      and dv.platform_user_id = p_actor_id
    where c.id = p_consultation_id
      and c.status = 'completed'
      and p.lifecycle_state = 'current'
      and m.membership_status = 'active'
      and dv.status = 'verified'
      and dv.expires_at > clock_timestamp()
      and graftvision_private.is_clinic_ready(c.clinic_id)
      and graftvision_private.has_application_session_permission(
        p_session_id, p_actor_id, 'clinic', c.clinic_id, p_permission_id
      )
  );
$$;

revoke all on function graftvision_private.is_assigned_verified_scan_doctor(uuid,uuid,uuid,text)
from public, anon, authenticated;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.create_scan_analyzer_handoff(uuid,uuid,uuid,integer,uuid)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'graftvision_private.is_assigned_verified_doctor(',
    'graftvision_private.is_assigned_verified_scan_doctor('
  );
  execute definition;
end;
$$;
