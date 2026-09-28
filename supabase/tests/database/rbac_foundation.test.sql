begin;
select plan(8);

-- Test 1: Tables exist
select has_table('role_definition', 'role_definition table should exist');
select has_table('permission_definition', 'permission_definition table should exist');
select has_table('role_permission', 'role_permission table should exist');

-- Test 2: Verify exactly 13 roles
select results_eq(
  'select count(*) from public.role_definition',
  ARRAY[13::bigint],
  'There should be exactly 13 roles in the authoritative catalogue'
);

-- Test 3: Verify exactly 60 permissions
select results_eq(
  'select count(*) from public.permission_definition',
  ARRAY[60::bigint],
  'There should be exactly 60 permissions in the authoritative catalogue'
);

-- Test 4: Prevent patient assignment to staff
prepare prevent_patient_role as
  insert into public.clinic_membership_role (clinic_membership_id, role_code)
  values ('00000000-0000-0000-0000-000000000000', 'PATIENT');
  
select throws_ok(
  'prevent_patient_role',
  '23514',
  'PATIENT role assignment through clinic_membership_role is prohibited pending explicit patient identity model',
  'Should block PATIENT role assignment'
);

-- Test 5: Authorization version columns exist
select has_column('platform_user', 'authorization_version', 'platform_user should have authorization_version');
select has_column('clinic_membership', 'authorization_version', 'clinic_membership should have authorization_version');

select * from finish();
rollback;
