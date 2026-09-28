begin;
select plan(23);

-- Setup: Create a platform owner to perform actions
insert into public.platform_user (id, external_identity_id) values ('00000000-0000-0000-0000-000000000001', 'owner@example.test');
insert into public.platform_user_role (platform_user_id, role_code) values ('00000000-0000-0000-0000-000000000001', 'PLATFORM_OWNER');

-- Setup: Create test user and two clinics
insert into public.platform_user (id, external_identity_id) values ('10000000-0000-0000-0000-000000000001', 'test-doctor@example.test');

insert into public.clinic (id, clinic_code, display_name) values ('20000000-0000-0000-0000-000000000001', 'clinic-a', 'Clinic A');
insert into public.clinic (id, clinic_code, display_name) values ('20000000-0000-0000-0000-000000000002', 'clinic-b', 'Clinic B');

insert into public.clinic_membership (id, clinic_id, platform_user_id) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.clinic_membership (id, clinic_id, platform_user_id) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values ('30000000-0000-0000-0000-000000000001', 'DOCTOR');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values ('30000000-0000-0000-0000-000000000002', 'DOCTOR');

-- Create active sessions
select graftvision_private.create_application_session(
  '10000000-0000-0000-0000-000000000001',
  'clinic',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour',
  'Device 1',
  'hash1'
) as session_a \gset

select graftvision_private.create_application_session(
  '10000000-0000-0000-0000-000000000001',
  'clinic',
  '20000000-0000-0000-0000-000000000002',
  '40000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 hour',
  'Device 2',
  'hash2'
) as session_b \gset

-- 1. Initial State Check
select ok(
  graftvision_private.validate_application_session(:'session_a'),
  'Session A should be valid initially'
);
select ok(
  graftvision_private.validate_application_session(:'session_b'),
  'Session B should be valid initially'
);

-- Set actor to PLATFORM_OWNER for deactivations.
select graftvision_private.set_test_tenant_context(
  '00000000-0000-0000-0000-000000000001',
  null
);

-- 2. Clinic A Membership Suspension
select public.deactivate_clinic_membership('30000000-0000-0000-0000-000000000001');

select ok(
  not graftvision_private.validate_application_session(:'session_a'),
  'Clinic A membership suspension invalidates only Clinic A sessions'
);

select results_eq(
  $$ select revoke_reason_code from public.application_session where id = '$$ || :'session_a' || $$' $$,
  $$ values ('DEACTIVATED') $$,
  'Session A revocation reason should be DEACTIVATED'
);

select ok(
  graftvision_private.validate_application_session(:'session_b'),
  'Clinic B remains valid when Clinic A is suspended'
);

-- 3. Reactivation does not restore stale sessions
select public.reactivate_clinic_membership('30000000-0000-0000-0000-000000000001');

select ok(
  not graftvision_private.validate_application_session(:'session_a'),
  'Reactivation does not restore stale sessions (Session A should still be revoked)'
);

-- Create new Session A
select graftvision_private.create_application_session(
  '10000000-0000-0000-0000-000000000001',
  'clinic',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  clock_timestamp() + interval '1 hour',
  'Device 1',
  'hash1'
) as session_a2 \gset

select ok(
  graftvision_private.validate_application_session(:'session_a2'),
  'New Session A should be valid after reactivation'
);

-- 4. Clinic A Role Change
-- We simulate RBAC version bump by incrementing authorization_version
update public.clinic_membership set authorization_version = authorization_version + 1 where id = '30000000-0000-0000-0000-000000000001';

select ok(
  not graftvision_private.validate_application_session(:'session_a2'),
  'Clinic A role change invalidates only Clinic A sessions'
);

select results_eq(
  $$ select revoke_reason_code from public.application_session where id = '$$ || :'session_a2' || $$' $$,
  $$ values ('REVOKE_ALL') $$,
  'Session A revocation reason should be REVOKE_ALL'
);

select ok(
  graftvision_private.validate_application_session(:'session_b'),
  'Clinic B remains valid when Clinic A roles change'
);

-- 5. Platform User Deactivation
select public.deactivate_platform_user('10000000-0000-0000-0000-000000000001');

select ok(
  not graftvision_private.validate_application_session(:'session_b'),
  'Platform-user deactivation invalidates every session'
);

select results_eq(
  $$ select revoke_reason_code from public.application_session where id = '$$ || :'session_b' || $$' $$,
  $$ values ('DEACTIVATED') $$,
  'Session B revocation reason should be DEACTIVATED'
);

-- 6. Platform User Reactivation
select public.reactivate_platform_user('10000000-0000-0000-0000-000000000001');

select ok(
  not graftvision_private.validate_application_session(:'session_b'),
  'Platform-user reactivation does not restore stale sessions'
);

-- 7. Platform Role Change
-- Create new session for testing platform role change
select graftvision_private.create_application_session(
  '10000000-0000-0000-0000-000000000001',
  'clinic',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-4000-8000-000000000004',
  clock_timestamp() + interval '1 hour',
  'Device 1',
  'hash1'
) as session_a3 \gset

update public.platform_user set authorization_version = authorization_version + 1 where id = '10000000-0000-0000-0000-000000000001';

select ok(
  not graftvision_private.validate_application_session(:'session_a3'),
  'Platform role change invalidates every user session'
);

select results_eq(
  $$ select revoke_reason_code from public.application_session where id = '$$ || :'session_a3' || $$' $$,
  $$ values ('REVOKE_ALL') $$,
  'Revocation reason should be REVOKE_ALL'
);

-- 8. Audit checks
select ok(
  (
    select count(*) from public.audit_event
    where action = 'membership.suspend'
      and resource_id = '30000000-0000-0000-0000-000000000001'
  ) = 1,
  'membership.suspend audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'membership.reactivate'
      and resource_id = '30000000-0000-0000-0000-000000000001'
  ) = 1,
  'membership.reactivate audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'user.deactivate'
      and resource_id = '10000000-0000-0000-0000-000000000001'
  ) = 1,
  'user.deactivate audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'user.reactivate'
      and resource_id = '10000000-0000-0000-0000-000000000001'
  ) = 1,
  'user.reactivate audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'session.revoke_inactive_membership'
      and resource_id = :'session_a'::uuid
  ) = 1,
  'session.revoke_inactive_membership audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'session.revoke_inactive_user'
      and resource_id = :'session_b'::uuid
  ) = 1,
  'session.revoke_inactive_user audit event created'
);
select ok(
  (
    select count(*) from public.audit_event
    where action = 'session.revoke_authorization_change'
      and resource_id in (:'session_a2'::uuid, :'session_a3'::uuid)
  ) = 2,
  'session.revoke_authorization_change audit event created'
);

-- 9. Null clinic context grants no platform authority
-- Test that the actor needs ADMIN-PERM-004 on platform
select graftvision_private.set_test_tenant_context(
  '10000000-0000-0000-0000-000000000001',
  null
);
select throws_ok(
  $$ select public.deactivate_platform_user('00000000-0000-0000-0000-000000000001') $$,
  '42501',
  'AUTH_PERMISSION_DENIED',
  'Null clinic context grants no platform authority'
);

-- Rollback restores all state
select * from finish();
rollback;
