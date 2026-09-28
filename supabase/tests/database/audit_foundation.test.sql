-- AUDIT-001 database-level append-only audit foundation tests.
-- Synthetic fixtures only. Every assertion runs inside this transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

insert into public.platform_user (id, external_identity_id, status)
values
  ('41111111-1111-4111-8111-111111111111', 'audit-user-alpha', 'active'),
  ('42222222-2222-4222-8222-222222222222', 'audit-user-beta', 'active');

insert into public.clinic (id, clinic_code, display_name, status)
values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'audit-clinic-alpha', 'Audit Clinic Alpha', 'active'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'audit-clinic-beta', 'Audit Clinic Beta', 'active');

insert into public.clinic_membership (
  id,
  clinic_id,
  platform_user_id,
  membership_status
)
values
  (
    '41111111-aaaa-4111-8111-111111111111',
    'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '41111111-1111-4111-8111-111111111111',
    'active'
  ),
  (
    '42222222-bbbb-4222-8222-222222222222',
    'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '42222222-2222-4222-8222-222222222222',
    'active'
  ),
  (
    '41111111-bbbb-4111-8111-111111111111',
    'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '41111111-1111-4111-8111-111111111111',
    'suspended'
  );

select has_table('public', 'audit_event', 'audit_event exists');

select col_is_pk(
  'public',
  'audit_event',
  'id',
  'audit_event uses one opaque primary identifier'
);

select results_eq(
  $$
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.audit_event'::regclass
  $$,
  $$ values (true) $$,
  'audit_event has RLS enabled'
);

select results_eq(
  $$
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.audit_event'::regclass
  $$,
  $$ values (true) $$,
  'audit_event has RLS forced'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'audit_event'
  $$,
  $$ values (0::bigint) $$,
  'Option A creates no normal audit read or write policies'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'INSERT'),
  'authenticated has no direct audit insert privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'UPDATE'),
  'authenticated has no audit update privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'DELETE'),
  'authenticated has no audit delete privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'SELECT'),
  'authenticated has no audit read privilege'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'graftvision_private.write_clinic_audit_event(text,text,uuid,text,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute the clinic audit writer'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'graftvision_private.write_platform_system_audit_event(text,text,uuid,text,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute the platform-system audit writer'
);

set local role authenticated;

select throws_ok(
  $$
    insert into public.audit_event (
      audit_scope,
      actor_type,
      action,
      resource_type,
      outcome,
      source_application
    )
    values ('platform', 'system', 'audit.create', 'system', 'success', 'system')
  $$,
  '42501',
  null,
  'an ordinary user cannot insert an audit event directly'
);

select throws_ok(
  $$ select count(*) from public.audit_event $$,
  '42501',
  null,
  'an ordinary user cannot read audit events'
);

reset role;
select graftvision_private.clear_test_tenant_context();

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      null,
      'database',
      '{}'::jsonb
    )
  $$,
  '42501',
  'audit tenant context is required',
  'missing tenant context cannot create a clinic audit event'
);

select graftvision_private.set_test_tenant_context(
  null,
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      null,
      'database',
      '{}'::jsonb
    )
  $$,
  '42501',
  'audit actor context is required',
  'missing actor context cannot create a user audit event'
);

select graftvision_private.set_test_tenant_context(
  '41111111-1111-4111-8111-111111111111',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select lives_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'success',
      'policy.allowed',
      '70000000-0000-4000-8000-000000000001',
      'database',
      '{"affected_count": 1, "policy_decision_code": "membership.active"}'::jsonb
    )
  $$,
  'a valid clinic event inserts through the controlled function'
);

select results_eq(
  $$
    select clinic_id
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'clinic ID is derived from trusted context'
);

select results_eq(
  $$
    select actor_platform_user_id
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('41111111-1111-4111-8111-111111111111'::uuid) $$,
  'actor ID is derived from trusted context'
);

select results_eq(
  $$
    select pg_get_function_arguments(
      'graftvision_private.write_clinic_audit_event(text,text,uuid,text,text,uuid,text,jsonb)'::regprocedure
    )
  $$,
  $$
    values (
      'event_action text, event_resource_type text, event_resource_id uuid, event_outcome text, event_reason_code text, event_request_id uuid, event_source_application text, event_metadata jsonb'::text
    )
  $$,
  'the writer exposes no actor or clinic override argument'
);

select graftvision_private.set_test_tenant_context(
  '42222222-2222-4222-8222-222222222222',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read', 'clinic', null, 'denied', 'tenant.denied', null, 'database', '{}'::jsonb
    )
  $$,
  '42501',
  'audit tenant context is not authorised',
  'cross-clinic audit write is denied'
);

select graftvision_private.set_test_tenant_context(
  '41111111-1111-4111-8111-111111111111',
  'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read', 'clinic', null, 'denied', 'membership.suspended', null, 'database', '{}'::jsonb
    )
  $$,
  '42501',
  'audit tenant context is not authorised',
  'suspended membership audit write is denied'
);

select graftvision_private.set_test_tenant_context(
  '41111111-1111-4111-8111-111111111111',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'patient.read', 'clinic', null, 'denied', null, null, 'database', '{}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'invalid action is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read', 'unknown_resource', null, 'denied', null, null, 'database', '{}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'invalid resource type is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read', 'clinic', null, 'partial', null, null, 'database', '{}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'invalid outcome is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read', 'clinic', null, 'success', null, null, 'worker', '{}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'invalid source application is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      null,
      'database',
      '{"arbitrary": "value"}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'unknown metadata key is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      null,
      'database',
      jsonb_build_object(
        'changed_fields',
        to_jsonb(array(
          select 'field_' || generate_series || '_' || repeat('x', 54)
          from generate_series(1, 32)
        ))
      )
    )
  $$,
  '22023',
  'audit event input is invalid',
  'oversized metadata is rejected'
);

select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      null,
      'database',
      '{"patient_name": "Synthetic Person"}'::jsonb
    )
  $$,
  '22023',
  'audit event input is invalid',
  'sensitive-looking metadata key is rejected'
);

select ok(
  (
    select occurred_at <= timezone('utc', statement_timestamp())
      and occurred_at > timezone('utc', statement_timestamp()) - interval '1 minute'
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000001'
  ),
  'event timestamp is generated by the database'
);

select ok(
  (
    select id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000001'
  ),
  'event ID is an opaque UUID'
);

select throws_ok(
  $$
    update public.audit_event
    set outcome = 'failure'
    where request_id = '70000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'audit events are immutable',
  'an existing audit event cannot be updated'
);

select throws_ok(
  $$
    delete from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'audit events are immutable',
  'an existing audit event cannot be deleted'
);

select lives_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'audit.correct',
      'audit_event',
      (
        select id
        from public.audit_event
        where request_id = '70000000-0000-4000-8000-000000000001'
      ),
      'success',
      'correction.appended',
      '70000000-0000-4000-8000-000000000002',
      'database',
      '{"changed_fields": ["outcome"]}'::jsonb
    )
  $$,
  'a correction is represented by a second event'
);

select results_eq(
  $$ select count(*)::bigint from public.audit_event where audit_scope = 'clinic' $$,
  $$ values (2::bigint) $$,
  'the original and correction remain as two immutable events'
);

savepoint audit_write_rollback;
select graftvision_private.write_clinic_audit_event(
  'audit.create',
  'audit_event',
  null,
  'failure',
  'transaction.failed',
  '70000000-0000-4000-8000-000000000003',
  'database',
  '{"error_code": "SYNTHETIC_FAILURE"}'::jsonb
);
rollback to savepoint audit_write_rollback;

select results_eq(
  $$
    select count(*)::bigint
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000003'
  $$,
  $$ values (0::bigint) $$,
  'a failed transaction rolls back its audit event'
);

select lives_ok(
  $$
    select graftvision_private.write_platform_system_audit_event(
      'system.migration',
      'system',
      null,
      'success',
      'migration.applied',
      '70000000-0000-4000-8000-000000000004',
      'database',
      '{"affected_count": 1}'::jsonb
    )
  $$,
  'the distinct owner-only platform-system path creates an event'
);

select results_eq(
  $$
    select audit_scope, clinic_id, actor_type, actor_platform_user_id
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000004'
  $$,
  $$ values ('platform'::text, null::uuid, 'system'::text, null::uuid) $$,
  'platform system scope remains structurally separate from clinic actors'
);

set local role authenticated;

select throws_ok(
  $$
    select count(*)
    from public.audit_event
    where request_id = '70000000-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'a platform-scoped event is hidden from ordinary clinic context'
);

reset role;

select results_eq(
  $$
    select confdeltype, confupdtype
    from pg_catalog.pg_constraint
    where conname in (
      'audit_event_actor_platform_user_fk',
      'audit_event_clinic_fk'
    )
    order by conname
  $$,
  $$ values ('r'::"char", 'r'::"char"), ('r'::"char", 'r'::"char") $$,
  'audit foreign keys prohibit cascade update or deletion'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname in (
        'audit_event_actor_occurred_at_idx',
        'audit_event_clinic_occurred_at_idx',
        'audit_event_resource_occurred_at_idx'
      )
  $$,
  $$ values (3::bigint) $$,
  'only three investigation-oriented audit indexes are added'
);

select ok(
  (
    select count(*) = 2
      and bool_and(prosecdef)
      and bool_and(proconfig = array['search_path=""']::text[])
    from pg_catalog.pg_proc
    where oid in (
      'graftvision_private.write_clinic_audit_event(text,text,uuid,text,text,uuid,text,jsonb)'::regprocedure,
      'graftvision_private.write_platform_system_audit_event(text,text,uuid,text,text,uuid,text,jsonb)'::regprocedure
    )
  ),
  'controlled writers are security definer functions with pinned empty search paths'
);

select results_eq(
  $$ select count(*)::bigint from public.audit_event where actor_role_snapshot is not null $$,
  $$ values (0::bigint) $$,
  'role snapshots remain null until trusted roles exist'
);

select ok(
  graftvision_private.is_valid_audit_metadata(
    '{"changed_fields": ["membership_status"], "previous_status": "suspended", "new_status": "active"}'::jsonb
  ),
  'the database accepts allowlisted categorical metadata'
);

select ok(
  not graftvision_private.is_valid_audit_metadata(
    '{"error_code": {"stack": "synthetic"}}'::jsonb
  ),
  'the database rejects nested metadata structures'
);

select graftvision_private.clear_test_tenant_context();

select results_eq(
  $$
    select
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id()
  $$,
  $$ values (null::uuid, null::uuid) $$,
  'trusted context can be cleared after audit work'
);

savepoint audit_context_rollback;
select graftvision_private.set_test_tenant_context(
  '41111111-1111-4111-8111-111111111111',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
rollback to savepoint audit_context_rollback;

select results_eq(
  $$
    select
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id()
  $$,
  $$ values (null::uuid, null::uuid) $$,
  'trusted audit context is cleared by transaction rollback'
);

select ok(
  octet_length(
    convert_to(
      '{"changed_fields": ["membership_status"]}'::jsonb::text,
      'UTF8'
    )
  ) <= 2048,
  'the documented metadata limit is enforced in UTF-8 bytes'
);

select * from finish();

rollback;
