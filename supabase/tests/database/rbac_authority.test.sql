begin;

select plan(12);

-- 1. Full catalogue tuple parity
create temp table expected_role_permissions (
  role_code text,
  permission_id text
);

insert into expected_role_permissions (role_code, permission_id) values
  ('PLATFORM_OWNER', 'TENANT-ACCESS-002'), ('PLATFORM_OWNER', 'ADMIN-PERM-004'), ('PLATFORM_OWNER', 'ADMIN-PERM-005'), ('PLATFORM_OWNER', 'ADMIN-PERM-006'), ('PLATFORM_OWNER', 'ADMIN-PERM-007'), ('PLATFORM_OWNER', 'AUDIT-PERM-001'), ('PLATFORM_OWNER', 'ROLE-010'),
  ('PLATFORM_ADMIN', 'TENANT-ACCESS-002'), ('PLATFORM_ADMIN', 'ADMIN-PERM-004'), ('PLATFORM_ADMIN', 'ADMIN-PERM-005'), ('PLATFORM_ADMIN', 'ADMIN-PERM-006'), ('PLATFORM_ADMIN', 'AUDIT-PERM-001'), ('PLATFORM_ADMIN', 'EXPORT-PERM-002'),
  ('PLATFORM_SUPPORT', 'TENANT-ACCESS-002'), ('PLATFORM_SUPPORT', 'SUPPORT-PERM-002'), ('PLATFORM_SUPPORT', 'SUPPORT-PERM-003'), ('PLATFORM_SUPPORT', 'EXPORT-PERM-002'),
  ('CLINIC_OWNER', 'TENANT-ACCESS-001'), ('CLINIC_OWNER', 'TENANT-ACCESS-003'), ('CLINIC_OWNER', 'ADMIN-PERM-001'), ('CLINIC_OWNER', 'ADMIN-PERM-002'), ('CLINIC_OWNER', 'ADMIN-PERM-003'), ('CLINIC_OWNER', 'ADMIN-PERM-005'), ('CLINIC_OWNER', 'CONSULT-PERM-003'), ('CLINIC_OWNER', 'ROLE-006'), ('CLINIC_OWNER', 'ROLE-007'), ('CLINIC_OWNER', 'ROLE-008'), ('CLINIC_OWNER', 'ROLE-009'), ('CLINIC_OWNER', 'EXPORT-PERM-001'), ('CLINIC_OWNER', 'DELETE-PERM-001'), ('CLINIC_OWNER', 'DELETE-PERM-002'), ('CLINIC_OWNER', 'SUPPORT-PERM-001'), ('CLINIC_OWNER', 'AUDIT-PERM-002'),
  ('CLINIC_ADMIN', 'TENANT-ACCESS-001'), ('CLINIC_ADMIN', 'TENANT-ACCESS-003'), ('CLINIC_ADMIN', 'ADMIN-PERM-001'), ('CLINIC_ADMIN', 'ADMIN-PERM-003'), ('CLINIC_ADMIN', 'ADMIN-PERM-005'), ('CLINIC_ADMIN', 'CONSULT-PERM-003'), ('CLINIC_ADMIN', 'ROLE-006'), ('CLINIC_ADMIN', 'ROLE-009'), ('CLINIC_ADMIN', 'EXPORT-PERM-001'), ('CLINIC_ADMIN', 'DELETE-PERM-001'), ('CLINIC_ADMIN', 'SUPPORT-PERM-001'), ('CLINIC_ADMIN', 'AUDIT-PERM-002'),
  ('DOCTOR', 'TENANT-ACCESS-001'), ('DOCTOR', 'PATIENT-PERM-001'), ('DOCTOR', 'PATIENT-PERM-002'), ('DOCTOR', 'PATIENT-PERM-003'), ('DOCTOR', 'CONSULT-PERM-001'), ('DOCTOR', 'CONSULT-PERM-002'), ('DOCTOR', 'SCAN-PERM-001'), ('DOCTOR', 'SCAN-PERM-002'), ('DOCTOR', 'MODEL-PERM-001'), ('DOCTOR', 'MODEL-PERM-002'), ('DOCTOR', 'MEASURE-PERM-001'), ('DOCTOR', 'MEASURE-PERM-002'), ('DOCTOR', 'GRAFT-PERM-001'), ('DOCTOR', 'GRAFT-PERM-002'), ('DOCTOR', 'HAIRLINE-PERM-001'), ('DOCTOR', 'HAIRLINE-PERM-002'), ('DOCTOR', 'AI-PERM-001'), ('DOCTOR', 'AI-PERM-002'), ('DOCTOR', 'ROLE-001'), ('DOCTOR', 'ROLE-002'), ('DOCTOR', 'PROC-PERM-001'), ('DOCTOR', 'PROC-PERM-002'), ('DOCTOR', 'FOLLOW-PERM-001'), ('DOCTOR', 'FOLLOW-PERM-002'), ('DOCTOR', 'REPORT-PERM-001'), ('DOCTOR', 'REPORT-PERM-002'), ('DOCTOR', 'REPORT-PERM-003'), ('DOCTOR', 'REPORT-PERM-004'), ('DOCTOR', 'PRESENT-PERM-001'), ('DOCTOR', 'EXPORT-PERM-001'), ('DOCTOR', 'DELETE-PERM-001'), ('DOCTOR', 'SUPPORT-PERM-001'),
  ('CLINICAL_ASSISTANT', 'TENANT-ACCESS-001'), ('CLINICAL_ASSISTANT', 'PATIENT-PERM-001'), ('CLINICAL_ASSISTANT', 'PATIENT-PERM-002'), ('CLINICAL_ASSISTANT', 'CONSULT-PERM-001'), ('CLINICAL_ASSISTANT', 'SCAN-PERM-001'), ('CLINICAL_ASSISTANT', 'SCAN-PERM-002'), ('CLINICAL_ASSISTANT', 'PROC-PERM-001'), ('CLINICAL_ASSISTANT', 'FOLLOW-PERM-001'), ('CLINICAL_ASSISTANT', 'REPORT-PERM-002'),
  ('PROCEDURE_TECHNICIAN', 'TENANT-ACCESS-001'), ('PROCEDURE_TECHNICIAN', 'SCAN-PERM-001'), ('PROCEDURE_TECHNICIAN', 'PROC-PERM-001'),
  ('RECEPTION', 'TENANT-ACCESS-001'), ('RECEPTION', 'PATIENT-PERM-001'), ('RECEPTION', 'REPORT-PERM-004'),
  ('REPORT_COORDINATOR', 'TENANT-ACCESS-001'), ('REPORT_COORDINATOR', 'REPORT-PERM-002'), ('REPORT_COORDINATOR', 'REPORT-PERM-004'),
  ('PRESENTATION', 'TENANT-ACCESS-001'), ('PRESENTATION', 'PRESENT-PERM-002'), ('PRESENTATION', 'PRESENT-PERM-003'),
  ('REVIEWER', 'TENANT-ACCESS-001'), ('REVIEWER', 'PATIENT-PERM-002'), ('REVIEWER', 'PATIENT-PERM-003'), ('REVIEWER', 'SCAN-PERM-002'),
  ('PATIENT', 'PRESENT-PERM-002'), ('PATIENT', 'PRESENT-PERM-003');

select set_eq(
  'select role_code, permission_id from public.role_permission',
  'select role_code, permission_id from expected_role_permissions',
  'role_permission table matches expected exact tuples'
);

select results_eq(
  'select count(*)::integer from public.role_definition',
  ARRAY[13::integer],
  'Exactly 13 approved roles'
);

select results_eq(
  'select count(*)::integer from public.permission_definition',
  ARRAY[60::integer],
  'Exactly 60 approved permissions'
);

-- 2. Forced RLS & grants
select table_privs_are(
  'public', 'role_permission', 'authenticated',
  ARRAY['SELECT'],
  'role_permission is select-only for authenticated'
);

-- 3. Actor authority and active-state denial checks
select is(
  graftvision_private.has_permission('00000000-0000-0000-0000-000000000000'::uuid, null, 'ROLE-010'),
  false,
  'Unknown actor defaults to deny'
);

-- Prepare mock data for active-state checks
insert into public.clinic (id, clinic_code, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'alpha-clinic', 'Alpha', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'beta-clinic', 'Beta', 'suspended');

insert into public.platform_user (id, external_identity_id, status) values
  ('11111111-0000-0000-0000-000000000000', 'active-owner@example.test', 'active'),
  ('22222222-0000-0000-0000-000000000000', 'inactive-owner@example.test', 'suspended'),
  ('33333333-0000-0000-0000-000000000000', 'active-admin@example.test', 'active');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('11111111-1111-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '11111111-0000-0000-0000-000000000000', 'active'),
  ('22222222-2222-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000000', 'active'),
  ('33333333-3333-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '33333333-0000-0000-0000-000000000000', 'suspended'),
  ('44444444-4444-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '11111111-0000-0000-0000-000000000000', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('11111111-1111-0000-0000-000000000000', 'CLINIC_OWNER'),
  ('22222222-2222-0000-0000-000000000000', 'CLINIC_OWNER'),
  ('33333333-3333-0000-0000-000000000000', 'CLINIC_ADMIN'),
  ('44444444-4444-0000-0000-000000000000', 'CLINIC_ADMIN');

select is(
  graftvision_private.has_permission('11111111-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'ROLE-006'),
  true,
  'Active user in active clinic with active membership has permission'
);

select is(
  graftvision_private.has_permission('22222222-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'ROLE-006'),
  false,
  'Inactive user denied'
);

select is(
  graftvision_private.has_permission('33333333-0000-0000-0000-000000000000'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'ROLE-006'),
  false,
  'Inactive clinic denied'
);

select is(
  graftvision_private.has_permission('33333333-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'ROLE-006'),
  false,
  'Inactive membership denied'
);

-- 4. Self-escalation and cross-tenant checks

-- Set context to active owner.
select graftvision_private.set_test_tenant_context(
  '11111111-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111'
);

select lives_ok(
  $$ select graftvision_private.check_clinic_role_assignment('11111111-1111-1111-1111-111111111111'::uuid, 'CLINIC_ADMIN', false) $$,
  'Active Owner can assign CLINIC_ADMIN'
);

-- Set context to active admin (who has ROLE-006 but not ROLE-007)
-- Activate Admin's existing membership for the authority checks.
update public.clinic_membership
set membership_status = 'active'
where id = '33333333-3333-0000-0000-000000000000';

select graftvision_private.set_test_tenant_context(
  '33333333-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111'
);

select throws_ok(
  $$ select graftvision_private.check_clinic_role_assignment('11111111-1111-1111-1111-111111111111'::uuid, 'CLINIC_OWNER', false) $$,
  '42501', 'AUTH_PERMISSION_DENIED',
  'Clinic Admin cannot assign CLINIC_OWNER (self-escalation denial)'
);

select throws_ok(
  $$ select graftvision_private.check_platform_role_assignment('PLATFORM_ADMIN', false) $$,
  '42501', 'AUTH_PERMISSION_DENIED',
  'Clinic Admin cannot assign platform roles'
);

rollback;
