-- GraftVision migration
-- Task: RBAC-001 (Revision)
-- Purpose: Seed role_permission natively, add active-state evaluation and actor authority checks.
-- Created UTC: 20260727000001
-- Category: schema creation, constraints, indexes, functions, triggers, grants, and RLS policies

-- 1. Seed authoritative role_permission catalogue
insert into public.role_permission (role_code, permission_id) values
  ('PLATFORM_OWNER', 'TENANT-ACCESS-002'), ('PLATFORM_OWNER', 'ADMIN-PERM-004'), ('PLATFORM_OWNER', 'ADMIN-PERM-005'), ('PLATFORM_OWNER', 'ADMIN-PERM-006'), ('PLATFORM_OWNER', 'AUDIT-PERM-001'), ('PLATFORM_OWNER', 'ROLE-010'),
  ('PLATFORM_ADMIN', 'TENANT-ACCESS-002'), ('PLATFORM_ADMIN', 'ADMIN-PERM-004'), ('PLATFORM_ADMIN', 'ADMIN-PERM-005'), ('PLATFORM_ADMIN', 'ADMIN-PERM-006'), ('PLATFORM_ADMIN', 'AUDIT-PERM-001'), ('PLATFORM_ADMIN', 'EXPORT-PERM-002'),
  ('PLATFORM_SUPPORT', 'TENANT-ACCESS-002'), ('PLATFORM_SUPPORT', 'SUPPORT-PERM-002'), ('PLATFORM_SUPPORT', 'SUPPORT-PERM-003'), ('PLATFORM_SUPPORT', 'EXPORT-PERM-002'),
  ('CLINIC_OWNER', 'TENANT-ACCESS-001'), ('CLINIC_OWNER', 'TENANT-ACCESS-003'), ('CLINIC_OWNER', 'ADMIN-PERM-001'), ('CLINIC_OWNER', 'ADMIN-PERM-002'), ('CLINIC_OWNER', 'ADMIN-PERM-003'), ('CLINIC_OWNER', 'ADMIN-PERM-005'), ('CLINIC_OWNER', 'ROLE-006'), ('CLINIC_OWNER', 'ROLE-007'), ('CLINIC_OWNER', 'ROLE-008'), ('CLINIC_OWNER', 'ROLE-009'), ('CLINIC_OWNER', 'EXPORT-PERM-001'), ('CLINIC_OWNER', 'DELETE-PERM-001'), ('CLINIC_OWNER', 'DELETE-PERM-002'), ('CLINIC_OWNER', 'SUPPORT-PERM-001'), ('CLINIC_OWNER', 'AUDIT-PERM-002'),
  ('CLINIC_ADMIN', 'TENANT-ACCESS-001'), ('CLINIC_ADMIN', 'TENANT-ACCESS-003'), ('CLINIC_ADMIN', 'ADMIN-PERM-001'), ('CLINIC_ADMIN', 'ADMIN-PERM-003'), ('CLINIC_ADMIN', 'ADMIN-PERM-005'), ('CLINIC_ADMIN', 'ROLE-006'), ('CLINIC_ADMIN', 'ROLE-009'), ('CLINIC_ADMIN', 'EXPORT-PERM-001'), ('CLINIC_ADMIN', 'DELETE-PERM-001'), ('CLINIC_ADMIN', 'SUPPORT-PERM-001'), ('CLINIC_ADMIN', 'AUDIT-PERM-002'),
  ('DOCTOR', 'TENANT-ACCESS-001'), ('DOCTOR', 'PATIENT-PERM-001'), ('DOCTOR', 'PATIENT-PERM-002'), ('DOCTOR', 'PATIENT-PERM-003'), ('DOCTOR', 'CONSULT-PERM-001'), ('DOCTOR', 'CONSULT-PERM-002'), ('DOCTOR', 'SCAN-PERM-001'), ('DOCTOR', 'SCAN-PERM-002'), ('DOCTOR', 'MODEL-PERM-001'), ('DOCTOR', 'MODEL-PERM-002'), ('DOCTOR', 'MEASURE-PERM-001'), ('DOCTOR', 'MEASURE-PERM-002'), ('DOCTOR', 'GRAFT-PERM-001'), ('DOCTOR', 'GRAFT-PERM-002'), ('DOCTOR', 'HAIRLINE-PERM-001'), ('DOCTOR', 'HAIRLINE-PERM-002'), ('DOCTOR', 'AI-PERM-001'), ('DOCTOR', 'AI-PERM-002'), ('DOCTOR', 'ROLE-001'), ('DOCTOR', 'ROLE-002'), ('DOCTOR', 'PROC-PERM-001'), ('DOCTOR', 'PROC-PERM-002'), ('DOCTOR', 'FOLLOW-PERM-001'), ('DOCTOR', 'FOLLOW-PERM-002'), ('DOCTOR', 'REPORT-PERM-001'), ('DOCTOR', 'REPORT-PERM-002'), ('DOCTOR', 'REPORT-PERM-003'), ('DOCTOR', 'REPORT-PERM-004'), ('DOCTOR', 'PRESENT-PERM-001'), ('DOCTOR', 'EXPORT-PERM-001'), ('DOCTOR', 'DELETE-PERM-001'), ('DOCTOR', 'SUPPORT-PERM-001'),
  ('CLINICAL_ASSISTANT', 'TENANT-ACCESS-001'), ('CLINICAL_ASSISTANT', 'PATIENT-PERM-001'), ('CLINICAL_ASSISTANT', 'PATIENT-PERM-002'), ('CLINICAL_ASSISTANT', 'CONSULT-PERM-001'), ('CLINICAL_ASSISTANT', 'SCAN-PERM-001'), ('CLINICAL_ASSISTANT', 'SCAN-PERM-002'), ('CLINICAL_ASSISTANT', 'PROC-PERM-001'), ('CLINICAL_ASSISTANT', 'FOLLOW-PERM-001'), ('CLINICAL_ASSISTANT', 'REPORT-PERM-002'),
  ('PROCEDURE_TECHNICIAN', 'TENANT-ACCESS-001'), ('PROCEDURE_TECHNICIAN', 'SCAN-PERM-001'), ('PROCEDURE_TECHNICIAN', 'PROC-PERM-001'),
  ('RECEPTION', 'TENANT-ACCESS-001'), ('RECEPTION', 'PATIENT-PERM-001'), ('RECEPTION', 'REPORT-PERM-004'),
  ('REPORT_COORDINATOR', 'TENANT-ACCESS-001'), ('REPORT_COORDINATOR', 'REPORT-PERM-002'), ('REPORT_COORDINATOR', 'REPORT-PERM-004'),
  ('PRESENTATION', 'TENANT-ACCESS-001'), ('PRESENTATION', 'PRESENT-PERM-002'), ('PRESENTATION', 'PRESENT-PERM-003'),
  ('REVIEWER', 'TENANT-ACCESS-001'), ('REVIEWER', 'PATIENT-PERM-002'), ('REVIEWER', 'PATIENT-PERM-003'), ('REVIEWER', 'SCAN-PERM-002'),
  ('PATIENT', 'PRESENT-PERM-002'), ('PATIENT', 'PRESENT-PERM-003')
on conflict do nothing;

-- 2. Central authoritative database check for permission evaluation
create function graftvision_private.has_permission(p_actor_id uuid, p_clinic_id uuid, p_permission_id text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_has boolean;
begin
  if p_clinic_id is not null then
    select true into v_has
    from public.clinic_membership m
    join public.clinic c on m.clinic_id = c.id
    join public.platform_user u on m.platform_user_id = u.id
    join public.clinic_membership_role mr on mr.clinic_membership_id = m.id
    join public.role_permission rp on rp.role_code = mr.role_code
    join public.role_definition rd on rd.role_code = mr.role_code
    where u.id = p_actor_id
      and u.status = 'active'
      and c.id = p_clinic_id
      and c.status = 'active'
      and m.status = 'active'
      and rp.permission_id = p_permission_id
    limit 1;
  else
    select true into v_has
    from public.platform_user u
    join public.platform_user_role pr on pr.platform_user_id = u.id
    join public.role_permission rp on rp.role_code = pr.role_code
    join public.role_definition rd on rd.role_code = pr.role_code
    where u.id = p_actor_id
      and u.status = 'active'
      and rp.permission_id = p_permission_id
    limit 1;
  end if;

  return coalesce(v_has, false);
end;
$$;

revoke all on function graftvision_private.has_permission(uuid, uuid, text) from public;

-- 3. Controlled mutations directly verified via Database boundaries
create function graftvision_private.check_clinic_role_assignment(p_clinic_id uuid, p_role_code text, p_is_removal boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_has_auth boolean;
  v_auth_perm text;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;
  
  if p_is_removal then
    v_auth_perm := 'ROLE-009'; -- Permission to remove
  else
    v_auth_perm := 'ROLE-006'; -- Permission to assign
  end if;

  -- Verify basic assignment/removal auth
  v_has_auth := graftvision_private.has_permission(v_actor_id, p_clinic_id, v_auth_perm);
  
  -- Separation-of-duties explicit checks for escalation
  if p_role_code = 'CLINIC_OWNER' then
    v_has_auth := graftvision_private.has_permission(v_actor_id, p_clinic_id, 'ROLE-007');
  end if;

  if not v_has_auth then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
end;
$$;

revoke all on function graftvision_private.check_clinic_role_assignment(uuid, text, boolean) from public;

create function graftvision_private.check_platform_role_assignment(p_role_code text, p_is_removal boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_has_auth boolean;
begin
  v_actor_id := graftvision_private.current_platform_user_id();
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTH_SESSION_REQUIRED';
  end if;
  
  -- ROLE-010 is required for platform assignment/removal
  v_has_auth := graftvision_private.has_permission(v_actor_id, null, 'ROLE-010');
  
  if not v_has_auth then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
end;
$$;

revoke all on function graftvision_private.check_platform_role_assignment(text, boolean) from public;
