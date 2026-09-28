-- CLINIC-001 controlled clinic lifecycle tests.
-- Synthetic fixtures only; all changes are rolled back.

begin;

select plan(37);

insert into public.platform_user (id, external_identity_id, status) values
  ('c1000000-0000-4000-8000-000000000001', 'clinic-owner@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000002', 'clinic-admin@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000003', 'clinic-support@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000004', 'clinic-role@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000005', 'clinic-inactive@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000006', 'clinic-stale@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000007', 'clinic-revoked@example.test', 'active'),
  ('c1000000-0000-4000-8000-000000000008', 'clinic-locked@example.test', 'active');

insert into public.platform_user_role (platform_user_id, role_code) values
  ('c1000000-0000-4000-8000-000000000001', 'PLATFORM_OWNER'),
  ('c1000000-0000-4000-8000-000000000002', 'PLATFORM_ADMIN'),
  ('c1000000-0000-4000-8000-000000000003', 'PLATFORM_SUPPORT'),
  ('c1000000-0000-4000-8000-000000000005', 'PLATFORM_OWNER'),
  ('c1000000-0000-4000-8000-000000000006', 'PLATFORM_OWNER'),
  ('c1000000-0000-4000-8000-000000000007', 'PLATFORM_OWNER'),
  ('c1000000-0000-4000-8000-000000000008', 'PLATFORM_OWNER');

insert into public.clinic (id, clinic_code, display_name, status) values
  ('c2000000-0000-4000-8000-000000000001', 'lifecycle-a', 'Lifecycle Clinic A', 'active'),
  ('c2000000-0000-4000-8000-000000000002', 'lifecycle-b', 'Lifecycle Clinic B', 'active');

insert into public.clinic_membership (
  id, clinic_id, platform_user_id, membership_status
) values
  (
    'c3000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000004',
    'active'
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'c2000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000004',
    'active'
  );

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('c3000000-0000-4000-8000-000000000001', 'CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000002', 'CLINIC_OWNER');

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000001', 'platform', null,
  'c4000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour', 'platform-owner', null
) as owner_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000002', 'platform', null,
  'c4000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 hour', 'platform-admin', null
) as admin_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000003', 'platform', null,
  'c4000000-0000-4000-8000-000000000003',
  clock_timestamp() + interval '1 hour', 'platform-support', null
) as support_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000004', 'clinic',
  'c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000004',
  clock_timestamp() + interval '1 hour', 'clinic-a-role', null
) as clinic_a_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000004', 'clinic',
  'c2000000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000005',
  clock_timestamp() + interval '1 hour', 'clinic-b-role', null
) as clinic_b_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000005', 'platform', null,
  'c4000000-0000-4000-8000-000000000006',
  clock_timestamp() + interval '1 hour', 'inactive-platform-owner', null
) as inactive_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000006', 'platform', null,
  'c4000000-0000-4000-8000-000000000007',
  clock_timestamp() + interval '1 hour', 'stale-platform-owner', null
) as stale_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000007', 'platform', null,
  'c4000000-0000-4000-8000-000000000008',
  clock_timestamp() + interval '1 hour', 'revoked-platform-owner', null
) as revoked_session \gset

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000008', 'platform', null,
  'c4000000-0000-4000-8000-000000000009',
  clock_timestamp() + interval '1 hour', 'locked-platform-owner', null
) as locked_session \gset

update public.platform_user
set status = 'suspended'
where id = 'c1000000-0000-4000-8000-000000000005';

update public.platform_user
set authorization_version = authorization_version + 1
where id = 'c1000000-0000-4000-8000-000000000006';

update public.application_session
set revoked_at = clock_timestamp(),
    revoke_reason_code = 'REVOKE_ONE'
where id = :'revoked_session';

select graftvision_private.lock_application_session(
  :'locked_session',
  'c1000000-0000-4000-8000-000000000008',
  'MANUAL'
);

select ok(
  exists (
    select 1
    from public.role_permission
    where role_code = 'PLATFORM_OWNER' and permission_id = 'ADMIN-PERM-006'
  ),
  'Platform Owner retains exact ADMIN-PERM-006 lifecycle permission'
);

select ok(
  exists (
    select 1
    from public.role_permission
    where role_code = 'PLATFORM_ADMIN' and permission_id = 'ADMIN-PERM-006'
  ),
  'Platform Administrator retains exact ADMIN-PERM-006 lifecycle permission'
);

select ok(
  not exists (
    select 1
    from public.role_permission
    where role_code = 'PLATFORM_SUPPORT' and permission_id = 'ADMIN-PERM-006'
  ),
  'Platform Support Engineer remains denied ADMIN-PERM-006'
);

select is((select count(*) from public.role_definition), 13::bigint, 'role catalogue remains exactly thirteen roles');
select is((select count(*) from public.permission_definition), 60::bigint, 'permission catalogue remains exactly sixty permissions');

select graftvision_private.create_clinic(
  :'owner_session',
  'c1000000-0000-4000-8000-000000000001',
  'created-by-owner',
  'Created by Owner',
  'active',
  'PLATFORM_APPROVED'
) as owner_clinic \gset

select ok(:'owner_clinic'::uuid is not null, 'Platform Owner creates a clinic');
select is(
  (select status from public.clinic where id = :'owner_clinic'),
  'active',
  'clinic creation stores the approved initial status'
);
select is(
  (select count(*) from public.clinic_status_history where clinic_id = :'owner_clinic'),
  1::bigint,
  'clinic creation writes one immutable history event'
);
select is(
  (
    select count(*) from public.audit_event
    where resource_id = :'owner_clinic' and action = 'clinic.create'
  ),
  1::bigint,
  'clinic creation writes one audit event atomically'
);

select lives_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'created-by-admin', 'Created by Administrator',
      'suspended', 'PLATFORM_APPROVED'
    )$sql$,
    :'admin_session',
    'c1000000-0000-4000-8000-000000000002'
  ),
  'Platform Administrator creates a clinic'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'created-by-owner', 'Duplicate Code',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000001'
  ),
  '23505',
  'CLINIC_CODE_ALREADY_EXISTS',
  'duplicate clinic code is rejected'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'Admin', 'Valid Name',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'INVALID_CLINIC_CODE',
  'invalid clinic code is rejected'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'valid-name-code', 'test',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'INVALID_CLINIC_NAME',
  'prohibited clinic name is rejected'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'support-denied', 'Support Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'support_session',
    'c1000000-0000-4000-8000-000000000003'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'Platform Support Engineer is denied clinic creation'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'clinic-role-denied', 'Clinic Role Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'clinic_a_session',
    'c1000000-0000-4000-8000-000000000004'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'clinic-scoped roles are denied clinic creation'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'forged-context', 'Forged Context',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000002'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'forged provider identity is denied'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'inactive-denied', 'Inactive User Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'inactive_session',
    'c1000000-0000-4000-8000-000000000005'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'inactive platform user session is denied'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'stale-denied', 'Stale Session Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'stale_session',
    'c1000000-0000-4000-8000-000000000006'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'stale platform session is denied'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'revoked-denied', 'Revoked Session Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'revoked_session',
    'c1000000-0000-4000-8000-000000000007'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'revoked platform session is denied'
);

select throws_ok(
  format(
    $sql$select graftvision_private.create_clinic(
      %L::uuid, %L::uuid, 'locked-denied', 'Locked Session Denied',
      'active', 'PLATFORM_APPROVED'
    )$sql$,
    :'locked_session',
    'c1000000-0000-4000-8000-000000000008'
  ),
  '42501',
  'AUTH_PERMISSION_DENIED',
  'locked platform session is denied'
);

select graftvision_private.transition_clinic_status(
  :'owner_session',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'suspended',
  'OPERATIONAL_HOLD'
);

select is(
  (select status from public.clinic where id = 'c2000000-0000-4000-8000-000000000001'),
  'suspended',
  'active clinic may be suspended'
);
select is(
  (
    select authorization_version
    from public.clinic_membership
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  3,
  'suspension increments the affected membership authorization version exactly once'
);
select is(
  graftvision_private.validate_application_session(:'clinic_a_session'),
  false,
  'suspension immediately denies the affected clinic session'
);
select is(
  graftvision_private.validate_application_session(:'clinic_b_session'),
  true,
  'Clinic A suspension does not affect Clinic B'
);
select is(
  graftvision_private.validate_application_session(:'owner_session'),
  true,
  'clinic suspension does not revoke the platform session'
);

select graftvision_private.transition_clinic_status(
  :'admin_session',
  'c1000000-0000-4000-8000-000000000002',
  'c2000000-0000-4000-8000-000000000001',
  'active',
  'OPERATIONAL_RESOLVED'
);

select is(
  (select status from public.clinic where id = 'c2000000-0000-4000-8000-000000000001'),
  'active',
  'suspended clinic may be reactivated'
);
select is(
  graftvision_private.validate_application_session(:'clinic_a_session'),
  false,
  'reactivation does not restore the old clinic session'
);

select throws_ok(
  format(
    $sql$select graftvision_private.transition_clinic_status(
      %L::uuid, %L::uuid, %L::uuid, 'active', 'OPERATIONAL_RESOLVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'INVALID_CLINIC_STATUS_TRANSITION',
  'unsupported active to active transition is rejected'
);

select is(
  (select count(*) from public.clinic_status_history where clinic_id = 'c2000000-0000-4000-8000-000000000001'),
  2::bigint,
  'failed transition rolls back without extra history'
);

select graftvision_private.transition_clinic_status(
  :'owner_session',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'inactive',
  'PLATFORM_INACTIVATED'
);

select is(
  (select status from public.clinic where id = 'c2000000-0000-4000-8000-000000000001'),
  'inactive',
  'active clinic may be inactivated'
);

select throws_ok(
  format(
    $sql$select graftvision_private.transition_clinic_status(
      %L::uuid, %L::uuid, %L::uuid, 'active', 'OPERATIONAL_RESOLVED'
    )$sql$,
    :'owner_session',
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'INVALID_CLINIC_STATUS_TRANSITION',
  'inactive clinic cannot be reactivated'
);

select throws_ok(
  $$
    update public.clinic
    set status = 'active'
    where id = 'c2000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'CLINIC_LIFECYCLE_CONTROLLED_TRANSITION_REQUIRED',
  'direct clinic lifecycle mutation is denied'
);

select throws_ok(
  $$
    update public.clinic
    set clinic_code = 'changed-code'
    where id = 'c2000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'CLINIC_CODE_IMMUTABLE',
  'clinic code is immutable'
);

select throws_ok(
  $$
    update public.clinic_status_history
    set reason_code = 'OPERATIONAL_HOLD'
    where clinic_id = 'c2000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'CLINIC_STATUS_HISTORY_IMMUTABLE',
  'clinic status history updates are denied'
);

select throws_ok(
  $$
    delete from public.clinic_status_history
    where clinic_id = 'c2000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'CLINIC_STATUS_HISTORY_IMMUTABLE',
  'clinic status history deletion is denied'
);

select ok(
  not exists (
    select 1
    from public.audit_event
    where action in ('clinic.create', 'clinic.suspend', 'clinic.reactivate', 'clinic.inactivate')
      and (
        metadata::text ~* '(token|cookie|credential|patient|request.body|user.agent)'
        or length(coalesce(reason_code, '')) > 64
      )
  ),
  'clinic lifecycle audit events exclude sensitive data and unrestricted text'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.clinic_status_history'::regclass
  ),
  'clinic status history enables and forces RLS'
);

rollback;
