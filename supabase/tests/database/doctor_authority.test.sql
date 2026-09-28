-- APPROVAL-001 clinic-specific Doctor authority tests.
-- Synthetic fixtures only; all changes are rolled back.

begin;

select plan(33);

insert into public.clinic (id, clinic_code, display_name, status) values
  ('d2000000-0000-4000-8000-000000000001', 'doctor-authority-a', 'Doctor Authority A', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'doctor-authority-b', 'Doctor Authority B', 'active');

insert into public.platform_user (id, external_identity_id, status) values
  ('d1000000-0000-4000-8000-000000000001', 'owner-a@example.test', 'active'),
  ('d1000000-0000-4000-8000-000000000002', 'admin-a@example.test', 'active'),
  ('d1000000-0000-4000-8000-000000000003', 'doctor-a@example.test', 'active'),
  ('d1000000-0000-4000-8000-000000000004', 'doctor-b@example.test', 'active'),
  ('d1000000-0000-4000-8000-000000000005', 'support@example.test', 'active');

insert into public.platform_user_role (platform_user_id, role_code) values
  ('d1000000-0000-4000-8000-000000000005', 'PLATFORM_SUPPORT');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'active'),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'active'),
  ('d3000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'active'),
  ('d3000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000004', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('d3000000-0000-4000-8000-000000000001', 'CLINIC_OWNER'),
  ('d3000000-0000-4000-8000-000000000001', 'DOCTOR'),
  ('d3000000-0000-4000-8000-000000000002', 'CLINIC_ADMIN'),
  ('d3000000-0000-4000-8000-000000000003', 'DOCTOR'),
  ('d3000000-0000-4000-8000-000000000004', 'DOCTOR');

select ok(
  exists (
    select 1 from public.role_permission
    where role_code = 'CLINIC_OWNER' and permission_id = 'ROLE-007'
  ),
  'ROLE-007 remains the approved Clinic Owner high-risk role permission'
);

select ok(
  exists (
    select 1 from public.role_permission
    where role_code in ('CLINIC_OWNER', 'CLINIC_ADMIN') and permission_id = 'ROLE-009'
    group by permission_id having count(*) = 2
  ),
  'ROLE-009 remains the approved Owner and Administrator revocation permission'
);

select is((select count(*) from public.role_definition), 13::bigint, 'role catalogue remains exactly thirteen roles');
select is((select count(*) from public.permission_definition), 60::bigint, 'permission catalogue remains exactly sixty permissions');

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000001', 'clinic',
  'd2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour', 'owner-a', null
) as owner_session \gset

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000002', 'clinic',
  'd2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 hour', 'admin-a', null
) as admin_session \gset

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000003', 'clinic',
  'd2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000003',
  clock_timestamp() + interval '1 hour', 'doctor-a-before-verification', null
) as stale_doctor_session \gset

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000005', 'platform', null,
  'd4000000-0000-4000-8000-000000000004',
  clock_timestamp() + interval '1 hour', 'support-platform', null
) as support_session \gset

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'owner_session', 'ROLE-001'),
  false,
  'combined Clinic Owner and Doctor roles do not imply Doctor authority'
);

select throws_ok(
  $$
    select graftvision_private.transition_doctor_verification(
      (select id from public.application_session where provider_session_id = 'd4000000-0000-4000-8000-000000000001'),
      'd1000000-0000-4000-8000-000000000001',
      'pending', 'INITIAL_REVIEW', null, null, null, null, null
    )
  $$,
  '42501',
  'SELF_VERIFICATION_DENIED',
  'self-verification is denied'
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  2,
  'Doctor role assignment established the initial authorization version'
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'pending', 'INITIAL_REVIEW', null, null, null, null, null
) as verification_id \gset

select is(
  (select status from public.doctor_verification where id = :'verification_id'),
  'pending',
  'controlled transition creates one pending current record'
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  2,
  'pending does not change effective Doctor authority version'
);

select is(
  (select count(*) from public.doctor_verification_evidence where doctor_verification_id = :'verification_id'),
  0::bigint,
  'pending state has no restricted evidence metadata'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'stale_doctor_session', 'ROLE-001'),
  false,
  'pending verification grants no Doctor authority'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'rejected', 'VERIFICATION_REJECTED', null, null, null, null, null
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  2,
  'rejection does not change already-denied effective Doctor authority'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'stale_doctor_session', 'ROLE-001'),
  false,
  'rejected verification grants no Doctor authority'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'pending', 'REVERIFICATION_REQUIRED', null, null, null, null, null
);

select throws_ok(
  $$
    update public.doctor_verification
    set status = 'rejected'
    where clinic_id = 'd2000000-0000-4000-8000-000000000001'
      and platform_user_id = 'd1000000-0000-4000-8000-000000000003'
  $$,
  '55000',
  'DOCTOR_VERIFICATION_CONTROLLED_TRANSITION_REQUIRED',
  'direct current-state mutation is denied'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$
    select graftvision_private.transition_doctor_verification(
      (select id from public.application_session where provider_session_id = 'd4000000-0000-4000-8000-000000000002'),
      'd1000000-0000-4000-8000-000000000003',
      'verified', 'VERIFICATION_APPROVED',
      clock_timestamp() + interval '1 day',
      'professional_registration', 'Restricted Authority', 'REF-ADMIN-DENIED', null
    )
  $$,
  '42501',
  'AUTH_PERMISSION_DENIED',
  'Clinic Administrator cannot verify without ROLE-007'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'verified', 'VERIFICATION_APPROVED',
  clock_timestamp() + interval '1 day',
  'professional_registration', 'Restricted Authority', 'REF-DOCTOR-A', 'Reviewed metadata only'
);

select is(
  (select status from public.doctor_verification where id = :'verification_id'),
  'verified',
  'only verified is stored as eligible current state'
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  3,
  'verification materially increments membership authorization version'
);

select is(
  graftvision_private.has_doctor_authority(:'stale_doctor_session', 'ROLE-001'),
  false,
  'pre-verification Doctor session is stale immediately'
);

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000003', 'clinic',
  'd2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000005',
  clock_timestamp() + interval '1 hour', 'doctor-a-verified', null
) as verified_doctor_session \gset

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000001'
);

select ok(
  graftvision_private.has_doctor_authority(:'verified_doctor_session', 'ROLE-001'),
  'same-clinic verified Doctor with required permission has authority'
);

select is(
  graftvision_private.has_doctor_authority(:'verified_doctor_session', 'ADMIN-PERM-001'),
  false,
  'verified Doctor still requires the requested RBAC permission'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000002'
);

select is(
  graftvision_private.has_doctor_authority(:'verified_doctor_session', 'ROLE-001'),
  false,
  'Clinic A verification never grants Clinic B authority'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000005',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'support_session', 'ROLE-001'),
  false,
  'Platform Support receives no Doctor authority'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000001'
);

select graftvision_private.transition_doctor_verification(
  :'admin_session',
  'd1000000-0000-4000-8000-000000000003',
  'revoked', 'VERIFICATION_REVOKED', null, null, null, null, null
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  4,
  'revocation materially increments membership authorization version'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'verified_doctor_session', 'ROLE-001'),
  false,
  'revocation immediately denies the previously valid Doctor session'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$
    select graftvision_private.transition_doctor_verification(
      (select id from public.application_session where provider_session_id = 'd4000000-0000-4000-8000-000000000001'),
      'd1000000-0000-4000-8000-000000000003',
      'verified', 'VERIFICATION_APPROVED',
      clock_timestamp() + interval '1 day',
      'professional_registration', 'Restricted Authority', 'REF-DIRECT-REACTIVATION', null
    )
  $$,
  '22023',
  'VERIFICATION_REVIEW_REQUIRED',
  'revoked verification cannot reactivate directly'
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'pending', 'REVERIFICATION_REQUIRED', null, null, null, null, null
);

select graftvision_private.transition_doctor_verification(
  :'owner_session',
  'd1000000-0000-4000-8000-000000000003',
  'verified', 'VERIFICATION_APPROVED',
  clock_timestamp() + interval '20 milliseconds',
  'clinic_credentialing', 'Restricted Authority', 'REF-REVERIFY', null
);

select is(
  (select count(*) from public.doctor_verification_history where doctor_verification_id = :'verification_id'),
  7::bigint,
  'reverification appends immutable transition history'
);

select throws_ok(
  $$
    update public.doctor_verification_history
    set reason_code = 'VERIFICATION_REJECTED'
    where doctor_verification_id = (
      select id from public.doctor_verification
      where clinic_id = 'd2000000-0000-4000-8000-000000000001'
        and platform_user_id = 'd1000000-0000-4000-8000-000000000003'
    )
  $$,
  '55000',
  'DOCTOR_VERIFICATION_HISTORY_IMMUTABLE',
  'history update is denied'
);

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000003', 'clinic',
  'd2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000006',
  clock_timestamp() + interval '1 hour', 'doctor-a-short-verification', null
) as expiring_doctor_session \gset

select pg_sleep(0.03);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_doctor_authority(:'expiring_doctor_session', 'ROLE-001'),
  false,
  'database time denies expired verification immediately'
);

select is(
  (
    select count(*) from public.audit_event
    where action = 'doctor.verification.expired'
      and resource_id = :'verification_id'
  ),
  0::bigint,
  'normal authority reads do not create expiry audit events'
);

select graftvision_private.set_test_tenant_context(
  'd1000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000001'
);

select graftvision_private.transition_doctor_verification(
  :'admin_session',
  'd1000000-0000-4000-8000-000000000003',
  'expired', 'VERIFICATION_EXPIRED', null, null, null, null, null
);

select is(
  (select authorization_version from public.clinic_membership where id = 'd3000000-0000-4000-8000-000000000003'),
  5,
  'recording an already-effective expiry does not increment authorization version'
);

select is(
  (
    select count(*) from public.audit_event
    where action = 'doctor.verification.expired'
      and resource_id = :'verification_id'
  ),
  1::bigint,
  'controlled expiry transition creates exactly one audit event'
);

select is(
  (
    select metadata ? 'issuing_authority'
      or metadata ? 'reference_identifier'
      or metadata ? 'internal_note'
    from public.audit_event
    where action = 'doctor.verification.verified'
      and resource_id = :'verification_id'
    order by occurred_at desc
    limit 1
  ),
  false,
  'restricted evidence metadata is excluded from audit metadata'
);

select throws_ok(
  $$
    set local role authenticated;
    select issuing_authority from public.doctor_verification_evidence;
  $$,
  '42501',
  null,
  'routine authenticated projections cannot read restricted evidence metadata'
);

reset role;

select * from finish();
rollback;
