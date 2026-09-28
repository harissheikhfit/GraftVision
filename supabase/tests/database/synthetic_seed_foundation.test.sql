-- TENANT-003 deterministic synthetic seed and isolation tests.
-- The repository reset applies the seed before this rollback-only pgTAP transaction.

begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select is(
  (
    select count(*)::integer
    from public.clinic
    where id = '20000000-0000-4000-8000-000000000001'
      and clinic_code = 'clinic-alpha'
      and display_name = 'Clinic Alpha'
      and status = 'active'
  ),
  1,
  'Clinic Alpha exists with its stable synthetic identity'
);

select is(
  (
    select count(*)::integer
    from public.clinic
    where id = '20000000-0000-4000-8000-000000000002'
      and clinic_code = 'clinic-beta'
      and display_name = 'Clinic Beta'
      and status = 'active'
  ),
  1,
  'Clinic Beta exists with its stable synthetic identity'
);

select results_eq(
  $$
    select id, clinic_code
    from public.clinic
    where id::text like '20000000-0000-4000-8000-00000000000_'
    order by id
  $$,
  $$
    values
      ('20000000-0000-4000-8000-000000000001'::uuid, 'clinic-alpha'::text),
      ('20000000-0000-4000-8000-000000000002'::uuid, 'clinic-beta'::text)
  $$,
  'synthetic clinic IDs and codes are deterministic'
);

select is(
  (
    select count(*)::integer
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
  ),
  5,
  'five synthetic platform users exist'
);

select results_eq(
  $$
    select id, external_identity_id
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
    order by id
  $$,
  $$
    values
      (
        '10000000-0000-4000-8000-000000000001'::uuid,
        'owner.alpha@example.test'::text
      ),
      (
        '10000000-0000-4000-8000-000000000002'::uuid,
        'staff.alpha@example.test'::text
      ),
      (
        '10000000-0000-4000-8000-000000000003'::uuid,
        'owner.beta@example.test'::text
      ),
      (
        '10000000-0000-4000-8000-000000000004'::uuid,
        'staff.beta@example.test'::text
      ),
      (
        '10000000-0000-4000-8000-000000000005'::uuid,
        'suspended.alpha@example.test'::text
      )
  $$,
  'synthetic user IDs and internal identity placeholders are deterministic'
);

select is(
  (
    select count(*)::integer
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
      and external_identity_id like '%@example.test'
  ),
  5,
  'every synthetic identity uses the reserved example.test domain'
);

select is(
  (
    select count(*)::integer
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
      and status = 'active'
  ),
  5,
  'all synthetic internal platform users are active'
);

select is(
  (
    select count(*)::integer
    from public.clinic_membership
    where id::text like '30000000-0000-4000-8000-00000000000_'
  ),
  5,
  'five deterministic synthetic memberships exist'
);

select results_eq(
  $$
    select id, clinic_id, platform_user_id, membership_status
    from public.clinic_membership
    where id::text like '30000000-0000-4000-8000-00000000000_'
    order by id
  $$,
  $$
    values
      (
        '30000000-0000-4000-8000-000000000001'::uuid,
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        'active'::text
      ),
      (
        '30000000-0000-4000-8000-000000000002'::uuid,
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        'active'::text
      ),
      (
        '30000000-0000-4000-8000-000000000003'::uuid,
        '20000000-0000-4000-8000-000000000002'::uuid,
        '10000000-0000-4000-8000-000000000003'::uuid,
        'active'::text
      ),
      (
        '30000000-0000-4000-8000-000000000004'::uuid,
        '20000000-0000-4000-8000-000000000002'::uuid,
        '10000000-0000-4000-8000-000000000004'::uuid,
        'active'::text
      ),
      (
        '30000000-0000-4000-8000-000000000005'::uuid,
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000005'::uuid,
        'suspended'::text
      )
  $$,
  'synthetic membership IDs, relationships, and statuses are deterministic'
);

select is(
  (
    select count(*)::integer
    from public.clinic_membership
    where id = '30000000-0000-4000-8000-000000000005'
      and membership_status = 'suspended'
  ),
  1,
  'the Alpha suspended-membership scenario exists explicitly'
);

select is(
  (
    select count(*)::integer
    from public.clinic_membership
    where (
      platform_user_id in (
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000005'
      )
      and clinic_id <> '20000000-0000-4000-8000-000000000001'
    ) or (
      platform_user_id in (
        '10000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000004'
      )
      and clinic_id <> '20000000-0000-4000-8000-000000000002'
    )
  ),
  0,
  'no unexpected cross-clinic synthetic membership exists'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('platform_user', 'clinic_membership')
      and column_name in ('role', 'role_id', 'permission', 'permissions')
  ),
  0,
  'the tenant foundation contains no role or permission columns'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('role', 'roles', 'permission', 'permissions', 'role_assignment')
  ),
  0,
  'the seed creates no role or permission tables'
);

select results_eq(
  $$
    select relrowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.platform_user'::regclass,
      'public.clinic'::regclass,
      'public.clinic_membership'::regclass,
      'public.audit_event'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true), (true) $$,
  'RLS remains enabled on all persistent foundation tables'
);

select results_eq(
  $$
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.platform_user'::regclass,
      'public.clinic'::regclass,
      'public.clinic_membership'::regclass,
      'public.audit_event'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true), (true) $$,
  'RLS remains forced on all persistent foundation tables'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('platform_user', 'clinic', 'clinic_membership')
  ),
  12,
  'the seed does not change the twelve tenant-foundation policies'
);

select is(
  (select count(*)::integer from public.audit_event),
  0,
  'reset-time seed setup creates no audit event'
);

select graftvision_private.clear_test_tenant_context();
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'missing context sees no synthetic clinic'
);

select is(
  (select count(*)::integer from public.clinic_membership),
  0,
  'missing context sees no synthetic membership'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic $$,
  $$ values ('clinic-alpha'::text) $$,
  'Alpha Owner accesses Clinic Alpha'
);

select is(
  (select count(*)::integer from public.clinic where clinic_code = 'clinic-beta'),
  0,
  'Alpha Owner cannot access Clinic Beta'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic $$,
  $$ values ('clinic-alpha'::text) $$,
  'Alpha Staff accesses Clinic Alpha'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic $$,
  $$ values ('clinic-beta'::text) $$,
  'Beta Owner accesses Clinic Beta'
);

select is(
  (select count(*)::integer from public.clinic where clinic_code = 'clinic-alpha'),
  0,
  'Beta Owner cannot access Clinic Alpha'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000002'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic $$,
  $$ values ('clinic-beta'::text) $$,
  'Beta Staff accesses Clinic Beta'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'the suspended member cannot access Clinic Alpha'
);

select is(
  (select count(*)::integer from public.clinic_membership),
  0,
  'the suspended membership is not exposed through RLS'
);

reset role;
select graftvision_private.clear_test_tenant_context();

select throws_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'active tenant membership is required',
  'trusted context rejects the suspended synthetic membership'
);

select lives_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'trusted context accepts the active Alpha Owner membership'
);

select results_eq(
  $$
    select
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id()
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'trusted context retains the stable Alpha actor and clinic identifiers'
);

select has_trigger(
  'public',
  'audit_event',
  'audit_event_prevent_mutation',
  'audit immutability remains installed'
);

select lives_ok(
  $$
    insert into public.audit_event (
      id,
      audit_scope,
      actor_type,
      action,
      resource_type,
      outcome,
      source_application,
      metadata
    )
    values (
      '90000000-0000-4000-8000-000000000001',
      'platform',
      'system',
      'system.migration',
      'system',
      'success',
      'system',
      '{}'::jsonb
    )
  $$,
  'a privileged synthetic audit fixture can be created for immutability verification'
);

select throws_ok(
  $$
    update public.audit_event
    set outcome = 'failure'
    where id = '90000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'audit events are immutable',
  'seed integration does not weaken audit-row immutability'
);

select is(
  (
    select count(*)::integer
    from public.audit_event
    where id = '90000000-0000-4000-8000-000000000001'
      and outcome = 'success'
  ),
  1,
  'the failed mutation leaves the synthetic audit fixture unchanged'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.clinic
        where id::text like '20000000-0000-4000-8000-00000000000_'),
      (select count(*)::integer from public.platform_user
        where id::text like '10000000-0000-4000-8000-00000000000_'),
      (select count(*)::integer from public.clinic_membership
        where id::text like '30000000-0000-4000-8000-00000000000_')
  $$,
  $$ values (2, 5, 5) $$,
  'the deterministic seed count remains two clinics, five users, and five memberships'
);

select is(
  (
    select count(*)::integer
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
      and external_identity_id not like '%@example.test'
  ),
  0,
  'the seed namespace contains no non-synthetic internal identity'
);

select * from finish();

rollback;
