-- RBAC-002 explicit application-session authority boundary tests.
-- Synthetic fixtures only; all changes are rolled back.

begin;

select plan(26);

insert into public.clinic (id, clinic_code, display_name, status) values
  ('a2000000-0000-4000-8000-000000000001', 'rbac-boundary-a', 'RBAC Boundary A', 'active'),
  ('b2000000-0000-4000-8000-000000000002', 'rbac-boundary-b', 'RBAC Boundary B', 'active');

insert into public.platform_user (id, external_identity_id, status) values
  ('a1000000-0000-4000-8000-000000000001', 'combined@example.test', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'support@example.test', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'inactive@example.test', 'suspended');

insert into public.platform_user_role (platform_user_id, role_code) values
  ('a1000000-0000-4000-8000-000000000001', 'PLATFORM_ADMIN'),
  ('a1000000-0000-4000-8000-000000000002', 'PLATFORM_SUPPORT'),
  ('a1000000-0000-4000-8000-000000000003', 'PLATFORM_ADMIN');

insert into public.clinic_membership (
  id, clinic_id, platform_user_id, membership_status
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'active'
);

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('a3000000-0000-4000-8000-000000000001', 'CLINIC_ADMIN');

select col_not_null(
  'public',
  'application_session',
  'authority_scope',
  'application sessions require explicit authority scope'
);

select set_eq(
  $$
    select permission_id
    from public.permission_definition
    where graftvision_private.is_platform_metadata_permission(permission_id)
  $$,
  $$
    values
      ('TENANT-ACCESS-002'::text),
      ('ADMIN-PERM-004'::text),
      ('ADMIN-PERM-005'::text),
      ('ADMIN-PERM-006'::text),
      ('ADMIN-PERM-007'::text),
      ('AUDIT-PERM-001'::text),
      ('ROLE-010'::text),
      ('EXPORT-PERM-002'::text),
      ('SUPPORT-PERM-002'::text),
      ('SUPPORT-PERM-003'::text)
  $$,
  'platform metadata permission allowlist is exact'
);

select throws_ok(
  $$
    insert into public.application_session (
      platform_user_id, authority_scope, platform_authorization_version,
      absolute_expires_at, device_label
    ) values (
      'a1000000-0000-4000-8000-000000000001', 'clinic', 1,
      clock_timestamp() + interval '1 hour', 'invalid-clinic-scope'
    )
  $$,
  '23514',
  null,
  'clinic scope requires a clinic identifier'
);

select throws_ok(
  $$
    insert into public.application_session (
      platform_user_id, authority_scope, clinic_id, platform_authorization_version,
      absolute_expires_at, device_label
    ) values (
      'a1000000-0000-4000-8000-000000000001', 'platform',
      'a2000000-0000-4000-8000-000000000001', 1,
      clock_timestamp() + interval '1 hour', 'invalid-platform-scope'
    )
  $$,
  '23514',
  null,
  'platform scope rejects clinic context'
);

select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000001',
  'platform',
  null,
  'c1000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour',
  'combined-platform',
  null
) as combined_platform_session \gset

select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000001',
  'clinic',
  'a2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 hour',
  'combined-clinic',
  null
) as combined_clinic_session \gset

select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000002',
  'platform',
  null,
  'c1000000-0000-4000-8000-000000000003',
  clock_timestamp() + interval '1 hour',
  'support-platform',
  null
) as support_platform_session \gset

select ok(
  graftvision_private.has_application_session_permission(
    :'combined_platform_session',
    'a1000000-0000-4000-8000-000000000001',
    'platform',
    null,
    'ADMIN-PERM-004'
  ),
  'platform session can use an allowlisted platform permission'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_platform_session',
    'a1000000-0000-4000-8000-000000000001',
    'clinic',
    'a2000000-0000-4000-8000-000000000001',
    'ADMIN-PERM-001'
  ),
  false,
  'platform session is denied clinic data'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_clinic_session',
    'a1000000-0000-4000-8000-000000000001',
    'platform',
    null,
    'ADMIN-PERM-004'
  ),
  false,
  'clinic session is denied platform administration'
);

select ok(
  graftvision_private.has_application_session_permission(
    :'combined_clinic_session',
    'a1000000-0000-4000-8000-000000000001',
    'clinic',
    'a2000000-0000-4000-8000-000000000001',
    'ADMIN-PERM-001'
  ),
  'combined-role user succeeds only in the matching clinic session'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_clinic_session',
    'a1000000-0000-4000-8000-000000000002',
    'clinic',
    'a2000000-0000-4000-8000-000000000001',
    'ADMIN-PERM-001'
  ),
  false,
  'forged provider identity is denied'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_clinic_session',
    'a1000000-0000-4000-8000-000000000001',
    'clinic',
    'b2000000-0000-4000-8000-000000000002',
    'ADMIN-PERM-001'
  ),
  false,
  'Clinic A session is denied Clinic B'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_clinic_session',
    'a1000000-0000-4000-8000-000000000001',
    'clinic',
    null,
    'ADMIN-PERM-001'
  ),
  false,
  'null clinic context never implies platform authority'
);

select is(
  graftvision_private.has_application_session_permission(
    :'combined_platform_session',
    'a1000000-0000-4000-8000-000000000001',
    'platform',
    null,
    'PATIENT-PERM-001'
  ),
  false,
  'platform metadata allowlist denies clinical permissions'
);

select ok(
  graftvision_private.has_application_session_permission(
    :'support_platform_session',
    'a1000000-0000-4000-8000-000000000002',
    'platform',
    null,
    'SUPPORT-PERM-002'
  ),
  'support engineer may use an allowlisted platform support permission'
);

select is(
  graftvision_private.has_application_session_permission(
    :'support_platform_session',
    'a1000000-0000-4000-8000-000000000002',
    'clinic',
    'a2000000-0000-4000-8000-000000000001',
    'PATIENT-PERM-001'
  ),
  false,
  'support engineer is denied tenant and clinical data'
);

select throws_ok(
  $$
    select graftvision_private.create_application_session(
      'a1000000-0000-4000-8000-000000000003',
      'platform',
      null,
      'c1000000-0000-4000-8000-000000000004',
      clock_timestamp() + interval '1 hour',
      'inactive-platform',
      null
    )
  $$,
  '28000',
  'INVALID_OR_INACTIVE_PLATFORM_USER',
  'inactive user cannot create a platform session'
);

select throws_ok(
  $$
    select graftvision_private.create_application_session(
      'a1000000-0000-4000-8000-000000000002',
      'clinic',
      'a2000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000005',
      clock_timestamp() + interval '1 hour',
      'support-clinic',
      null
    )
  $$,
  '28000',
  'ACTIVE_CLINIC_ROLE_REQUIRED',
  'support-only user cannot create a clinic session'
);

update public.application_session
set revoked_at = clock_timestamp(),
    revoke_reason_code = 'LOGOUT'
where id = :'combined_platform_session';

select is(
  graftvision_private.has_application_session_permission(
    :'combined_platform_session',
    'a1000000-0000-4000-8000-000000000001',
    'platform',
    null,
    'ADMIN-PERM-004'
  ),
  false,
  'revoked session is denied'
);

select graftvision_private.rotate_application_session_authority(
  :'combined_clinic_session',
  'a1000000-0000-4000-8000-000000000001',
  'platform',
  null,
  clock_timestamp() + interval '1 hour',
  'rotated-platform',
  null
) as rotated_platform_session \gset

select is(
  (
    select revoke_reason_code
    from public.application_session
    where id = :'combined_clinic_session'
  ),
  'SCOPE_CHANGE',
  'scope switch revokes the previous session'
);

select is(
  (
    select authority_scope
    from public.application_session
    where id = :'rotated_platform_session'
  ),
  'platform',
  'scope switch creates an explicit platform session'
);

select is(
  (
    select platform_authorization_version
    from public.application_session
    where id = :'rotated_platform_session'
  ),
  (
    select authorization_version
    from public.platform_user
    where id = 'a1000000-0000-4000-8000-000000000001'
  ),
  'scope switch captures a fresh platform authorization snapshot'
);

select is(
  (
    select clinic_authorization_version
    from public.application_session
    where id = :'rotated_platform_session'
  ),
  null,
  'platform rotation does not retain a clinic authorization snapshot'
);

select is(
  (
    select count(*)::integer
    from public.audit_event
    where action = 'authority.scope_change'
      and resource_id = :'rotated_platform_session'
  ),
  1,
  'scope switch is audited once'
);

select cmp_ok(
  (
    select count(*)::integer
    from public.audit_event
    where action = 'authority.cross_scope_denied'
      and resource_id in (
        :'combined_platform_session',
        :'combined_clinic_session',
        :'support_platform_session'
      )
  ),
  '>=',
  5,
  'high-risk cross-scope and support denials are audited'
);

select results_eq(
  'select count(*)::integer from public.role_definition',
  array[13],
  'role catalogue remains exactly thirteen roles'
);

select results_eq(
  'select count(*)::integer from public.permission_definition',
  array[60],
  'permission catalogue remains exactly sixty permissions'
);

select hasnt_function(
  'graftvision_private',
  'create_application_session',
  array['uuid', 'uuid', 'text', 'timestamp with time zone', 'text', 'text'],
  'legacy scope-inferred session constructor is absent'
);

select * from finish();
rollback;
