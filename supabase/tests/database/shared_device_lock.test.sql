-- AUTH-004 server-owned shared-device lock tests.
-- Synthetic fixtures only; all changes are rolled back.

begin;

select plan(36);

insert into public.clinic (id, clinic_code, display_name, status) values
  ('e2000000-0000-4000-8000-000000000001', 'lock-clinic-a', 'Lock Clinic A', 'active'),
  ('e2000000-0000-4000-8000-000000000002', 'lock-clinic-b', 'Lock Clinic B', 'active');

insert into public.platform_user (id, external_identity_id, status) values
  ('e1000000-0000-4000-8000-000000000001', 'lock-owner-a@example.test', 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'lock-owner-b@example.test', 'active');

insert into public.clinic_membership (
  id, clinic_id, platform_user_id, membership_status
) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'active'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('e3000000-0000-4000-8000-000000000001', 'CLINIC_OWNER'),
  ('e3000000-0000-4000-8000-000000000001', 'DOCTOR'),
  ('e3000000-0000-4000-8000-000000000002', 'CLINIC_OWNER');

select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000001', 'clinic',
  'e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour', 'shared-device-a', null
) as session_a \gset

select has_column('public', 'application_session', 'locked_at', 'locked_at is persisted');
select has_column('public', 'application_session', 'lock_reason_code', 'lock reason is persisted');
select has_column('public', 'application_session', 'reauthenticated_at', 'reauthentication time is persisted');

prepare invalid_lock_state as
update public.application_session
set lock_reason_code = 'MANUAL'
where id = :'session_a';

select throws_ok(
  'invalid_lock_state',
  '23514',
  null,
  'lock reason cannot exist without a lock timestamp'
);

select is(
  graftvision_private.lock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000002', 'MANUAL'
  ),
  false,
  'forged provider identity cannot lock another session'
);

select is(
  graftvision_private.lock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000001', 'MANUAL'
  ),
  true,
  'manual lock succeeds for the matching provider identity'
);

select is(
  (select lock_reason_code from public.application_session where id = :'session_a'),
  'MANUAL',
  'manual lock stores the controlled reason'
);

select isnt(
  (select locked_at from public.application_session where id = :'session_a'),
  null,
  'manual lock stores server time'
);

select is(
  graftvision_private.validate_application_session(:'session_a'),
  false,
  'locked session is denied by the normal session validator'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_a' and action = 'session.lock'),
  1::bigint,
  'manual lock is audited once'
);

select is(
  graftvision_private.lock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000001', 'MANUAL'
  ),
  true,
  'repeated lock is idempotent'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_a' and action = 'session.lock'),
  1::bigint,
  'repeated lock creates no duplicate audit event'
);

select is(
  graftvision_private.record_application_session_activity(
    :'session_a', 'e1000000-0000-4000-8000-000000000001'
  ),
  false,
  'locked session activity cannot reset idle time'
);

select is(
  graftvision_private.unlock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000001', 'platform', null
  ),
  false,
  'clinic session cannot unlock into platform scope'
);

select is(
  graftvision_private.unlock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000001', 'clinic',
    'e2000000-0000-4000-8000-000000000002'
  ),
  false,
  'cross-tenant clinic context cannot unlock'
);

select is(
  graftvision_private.unlock_application_session(
    :'session_a', 'e1000000-0000-4000-8000-000000000001', 'clinic',
    'e2000000-0000-4000-8000-000000000001'
  ),
  true,
  'matching clinic scope unlocks after provider reauthentication'
);

select is(
  (select authority_scope from public.application_session where id = :'session_a'),
  'clinic',
  'unlock preserves authority scope'
);

select is(
  (select clinic_id from public.application_session where id = :'session_a'),
  'e2000000-0000-4000-8000-000000000001'::uuid,
  'unlock preserves clinic scope'
);

select ok(
  (select locked_at is null and reauthenticated_at is not null
   from public.application_session where id = :'session_a'),
  'successful unlock clears lock and records reauthentication'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_a' and action = 'session.unlock'),
  1::bigint,
  'successful unlock is audited'
);

select is(
  graftvision_private.record_application_session_activity(
    :'session_a', 'e1000000-0000-4000-8000-000000000001'
  ),
  true,
  'approved active-session activity is recorded'
);

update public.application_session
set last_activity_at = clock_timestamp() - interval '26 minutes'
where id = :'session_a';

select is(
  graftvision_private.validate_application_session(:'session_a'),
  true,
  'warning threshold does not lock before thirty minutes'
);

update public.application_session
set last_activity_at = clock_timestamp() - interval '31 minutes'
where id = :'session_a';

select is(
  graftvision_private.validate_application_session(:'session_a'),
  false,
  'database time automatically locks after thirty idle minutes'
);

select is(
  (select lock_reason_code from public.application_session where id = :'session_a'),
  'IDLE',
  'automatic lock records the idle reason'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_a' and action = 'session.lock'),
  2::bigint,
  'automatic lock adds exactly one audit event'
);

select is(graftvision_private.validate_application_session(:'session_a'), false, 'locked reads remain denied');

select is(
  (select count(*) from public.audit_event where resource_id = :'session_a' and action = 'session.lock'),
  2::bigint,
  'normal locked reads do not duplicate lock audit events'
);

select is(graftvision_private.is_valid_audit_action('session.reauthentication_failed'), true, 'failed reauthentication action is controlled');
select is(graftvision_private.is_valid_audit_action('session.logout_after_lock'), true, 'locked logout action is controlled');

select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000002', 'clinic',
  'e2000000-0000-4000-8000-000000000002',
  'e4000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 hour', 'shared-device-b', null
) as session_b \gset

select is(
  graftvision_private.lock_application_session(
    :'session_b', 'e1000000-0000-4000-8000-000000000002', 'MANUAL'
  ),
  true,
  'second tenant session locks independently'
);

select is(
  graftvision_private.record_session_reauthentication_failed(
    :'session_b', 'e1000000-0000-4000-8000-000000000002'
  ),
  true,
  'failed password reauthentication is recorded for the locked session'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_b' and action = 'session.reauthentication_failed'),
  1::bigint,
  'failed reauthentication writes controlled audit only'
);

select is(
  graftvision_private.logout_locked_application_session(
    :'session_b', 'e1000000-0000-4000-8000-000000000002'
  ),
  true,
  'failed reauthentication can fall back to locked logout'
);

select isnt(
  (select revoked_at from public.application_session where id = :'session_b'),
  null,
  'logout fallback revokes the locked application session'
);

select is(
  (select count(*) from public.audit_event where resource_id = :'session_b' and action = 'session.logout_after_lock'),
  1::bigint,
  'logout fallback is audited'
);

select is(
  (select clinic_id from public.application_session where id = :'session_a'),
  'e2000000-0000-4000-8000-000000000001'::uuid,
  'combined Doctor role never changes clinic scope during lock transitions'
);

select * from finish();
rollback;
