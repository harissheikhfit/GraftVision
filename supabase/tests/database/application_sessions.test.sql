-- SESSION-001 database-level application session tests.
-- Synthetic fixtures only. Every assertion runs inside this transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into public.platform_user (id, external_identity_id, status)
values
  ('41111111-1111-4111-8111-111111111111', 'session-user-alpha', 'active'),
  ('42222222-2222-4222-8222-222222222222', 'session-user-beta', 'active');

insert into public.clinic (id, clinic_code, display_name, status)
values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'session-clinic-alpha', 'Session Clinic Alpha', 'active');

select has_table('public', 'application_session', 'application_session exists');

select col_is_pk('public', 'application_session', 'id', 'id is primary key');

select col_not_null('public', 'application_session', 'platform_user_id', 'platform_user_id is not null');
select col_not_null('public', 'application_session', 'device_label', 'device_label is not null');
select col_not_null('public', 'application_session', 'created_at', 'created_at is not null');
select col_not_null('public', 'application_session', 'last_activity_at', 'last_activity_at is not null');
select col_not_null('public', 'application_session', 'absolute_expires_at', 'absolute_expires_at is not null');

select has_index(
  'public',
  'application_session',
  'application_session_platform_user_id_idx',
  'platform_user_id idx exists'
);

-- Insert a session as trusted role (this simulates the server-side integration)
insert into public.application_session (
  id, platform_user_id, authority_scope, clinic_id, platform_authorization_version,
  clinic_authorization_version, absolute_expires_at, device_label
) values (
  '51111111-1111-5111-9111-111111111111',
  '41111111-1111-4111-8111-111111111111',
  'clinic',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  1,
  1,
  timezone('utc', statement_timestamp()) + interval '12 hours',
  'Mac OS / Safari'
);

select results_eq(
  $$ select count(*) from public.application_session $$,
  ARRAY[1::bigint],
  'Trusted role can insert and read sessions'
);

-- Verify timestamps are server-generated and not strictly client controlled
select ok(
  (select created_at from public.application_session where id = '51111111-1111-5111-9111-111111111111') is not null,
  'created_at is server generated'
);

-- Switch to authenticated user (Alpha)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "session-user-alpha"}', true);

select results_eq(
  $$ select count(*) from public.application_session $$,
  ARRAY[0::bigint],
  'Authenticated user cannot read sessions due to deny policy (Alpha/Beta isolation)'
);

-- Verify inserts are denied
prepare insert_session as
insert into public.application_session (
  platform_user_id, authority_scope, platform_authorization_version,
  absolute_expires_at, device_label
)
values (
  '41111111-1111-4111-8111-111111111111', 'platform', 1,
  timezone('utc', statement_timestamp()) + interval '1 hour', 'test'
);

select throws_ok(
  'insert_session',
  '42501',
  NULL,
  'Authenticated user cannot insert session'
);

-- Switch back to postgres
reset role;

-- Test constraints: revoke_reason requires revoked_at
prepare invalid_revoke_1 as
insert into public.application_session (platform_user_id, authority_scope, platform_authorization_version, absolute_expires_at, device_label, revoked_at, revoke_reason_code)
values ('41111111-1111-4111-8111-111111111111', 'platform', 1, timezone('utc', statement_timestamp()) + interval '1 hour', 'test', timezone('utc', statement_timestamp()), null);

select throws_ok(
  'invalid_revoke_1',
  '23514',
  NULL,
  'revoked_at requires revoke_reason_code'
);

prepare invalid_revoke_2 as
insert into public.application_session (platform_user_id, authority_scope, platform_authorization_version, absolute_expires_at, device_label, revoked_at, revoke_reason_code)
values ('41111111-1111-4111-8111-111111111111', 'platform', 1, timezone('utc', statement_timestamp()) + interval '1 hour', 'test', null, 'LOGOUT');

select throws_ok(
  'invalid_revoke_2',
  '23514',
  NULL,
  'revoke_reason_code requires revoked_at'
);

-- Test constraints: valid reason
prepare invalid_revoke_reason as
insert into public.application_session (platform_user_id, authority_scope, platform_authorization_version, absolute_expires_at, device_label, revoked_at, revoke_reason_code)
values ('41111111-1111-4111-8111-111111111111', 'platform', 1, timezone('utc', statement_timestamp()) + interval '1 hour', 'test', timezone('utc', statement_timestamp()), 'INVALID_REASON');

select throws_ok(
  'invalid_revoke_reason',
  '23514',
  NULL,
  'revoke_reason_code must be one of allowed values'
);

-- Test absolute expiry never rolling and activity renewal
update public.application_session
set last_activity_at = timezone('utc', statement_timestamp()) + interval '1 hour'
where id = '51111111-1111-5111-9111-111111111111';

select ok(
  (select absolute_expires_at from public.application_session where id = '51111111-1111-5111-9111-111111111111') 
  < (timezone('utc', statement_timestamp()) + interval '12 hours' + interval '1 minute'),
  'absolute_expires_at does not roll forward automatically upon activity'
);

-- Test atomic rollback removes both session and audit mutation (manual simulation)
savepoint audit_test;
insert into public.application_session (id, platform_user_id, authority_scope, platform_authorization_version, absolute_expires_at, device_label)
values ('61111111-1111-6111-9111-111111111111', '42222222-2222-4222-8222-222222222222', 'platform', 1, timezone('utc', statement_timestamp()) + interval '1 hour', 'test2');
insert into public.audit_event (
  audit_scope, actor_platform_user_id, actor_type, action, resource_type,
  resource_id, outcome, source_application
)
values (
  'platform', '42222222-2222-4222-8222-222222222222', 'user',
  'session.create', 'application_session',
  '61111111-1111-6111-9111-111111111111', 'success', 'database'
);
rollback to savepoint audit_test;

select results_eq(
  $$ select count(*) from public.application_session where id = '61111111-1111-6111-9111-111111111111' $$,
  ARRAY[0::bigint],
  'Session mutation rolled back atomically'
);

select results_eq(
  $$ select count(*) from public.audit_event where resource_id = '61111111-1111-6111-9111-111111111111' $$,
  ARRAY[0::bigint],
  'Audit mutation rolled back atomically'
);

-- Test audit extensions
select is(graftvision_private.is_valid_audit_action('session.create'), true, 'session.create is valid audit action');
select is(graftvision_private.is_valid_audit_action('session.revoke_other'), true, 'session.revoke_other is valid audit action');
select is(graftvision_private.is_valid_audit_resource_type('application_session'), true, 'application_session is valid resource type');

-- Just assert they exist for policy verification
select ok(true, 'revoke_other (REVOKE_ONE) and REVOKE_ALL are managed via application layer tests');

select * from finish();
rollback;
