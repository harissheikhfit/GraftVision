-- TENANT-001 database-level tenant isolation tests.
-- Synthetic fixtures only. Every assertion runs inside this transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

insert into public.platform_user (id, external_identity_id, status)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-alpha', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'member-beta', 'active'),
  ('33333333-3333-4333-8333-333333333333', 'missing-membership', 'active');

insert into public.clinic (id, clinic_code, display_name, status)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'isolation-clinic-alpha',
    'Isolation Clinic Alpha',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'isolation-clinic-beta',
    'Isolation Clinic Beta',
    'active'
  );

insert into public.clinic_membership (
  id,
  clinic_id,
  platform_user_id,
  membership_status
)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'active'
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'active'
  ),
  (
    'b1111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'suspended'
  );

select results_eq(
  $$
    select relrowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.platform_user'::regclass,
      'public.clinic'::regclass,
      'public.clinic_membership'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true) $$,
  'RLS is enabled on every tenant-foundation table'
);

select results_eq(
  $$
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.platform_user'::regclass,
      'public.clinic'::regclass,
      'public.clinic_membership'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true) $$,
  'RLS remains forced on every tenant-foundation table'
);

select graftvision_private.clear_test_tenant_context();
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.clinic $$,
  $$ values (0::bigint) $$,
  'missing tenant context returns no clinic rows'
);

select results_eq(
  $$ select count(*)::bigint from public.clinic_membership $$,
  $$ values (0::bigint) $$,
  'missing tenant context returns no membership rows'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic order by clinic_code $$,
  $$ values ('isolation-clinic-alpha'::text) $$,
  'User A can access Clinic Alpha through active membership'
);

select results_eq(
  $$ select id from public.clinic_membership order by id $$,
  $$ values ('a1111111-1111-4111-8111-111111111111'::uuid) $$,
  'User A can read only their active Clinic Alpha membership'
);

select results_eq(
  $$ select id from public.platform_user order by id $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'User A can read only their own platform identity'
);

select results_eq(
  $$ select clinic_code from public.clinic where clinic_code = 'isolation-clinic-beta' $$,
  $$ select clinic_code from public.clinic where false $$,
  'User A cannot enumerate Clinic Beta while scoped to Clinic Alpha'
);

select results_eq(
  $$
    select clinic.clinic_code
    from public.clinic_membership membership
    join public.clinic clinic on clinic.id = membership.clinic_id
    order by clinic.clinic_code
  $$,
  $$ values ('isolation-clinic-alpha'::text) $$,
  'cross-clinic joins expose only the trusted clinic'
);

select results_eq(
  $$
    select id
    from public.clinic_membership
    where id = 'b2222222-2222-4222-8222-222222222222'
  $$,
  $$ select id from public.clinic_membership where false $$,
  'guessing another clinic membership identifier leaks no row'
);

select throws_ok(
  $$
    insert into public.clinic_membership (
      clinic_id,
      platform_user_id,
      membership_status
    )
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      'active'
    )
  $$,
  '42501',
  null,
  'an ordinary user cannot create a membership for themselves'
);

select results_eq(
  $$
    update public.clinic_membership
    set membership_status = 'active'
    where id = 'a1111111-1111-4111-8111-111111111111'
    returning id
  $$,
  $$ select id from public.clinic_membership where false $$,
  'an ordinary user cannot update membership status'
);

select results_eq(
  $$
    update public.clinic_membership
    set clinic_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id = 'a1111111-1111-4111-8111-111111111111'
    returning id
  $$,
  $$ select id from public.clinic_membership where false $$,
  'an ordinary user cannot change membership clinic ownership'
);

select throws_ok(
  $$
    insert into public.clinic (clinic_code, display_name)
    values ('clinic-gamma', 'Clinic Gamma')
  $$,
  '42501',
  null,
  'ordinary users cannot create arbitrary tenant roots'
);

select results_eq(
  $$
    update public.clinic
    set status = 'suspended'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$ select id from public.clinic where false $$,
  'ordinary users cannot modify clinic status'
);

select throws_ok(
  $$
    select graftvision_private.set_test_tenant_context(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  $$,
  '42501',
  null,
  'authenticated callers cannot establish trusted context'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.clinic $$,
  $$ values (0::bigint) $$,
  'a suspended Clinic Beta membership denies User A'
);

select results_eq(
  $$ select count(*)::bigint from public.clinic_membership $$,
  $$ values (0::bigint) $$,
  'a suspended membership is not visible to User A'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
set local role authenticated;

select results_eq(
  $$ select clinic_code from public.clinic $$,
  $$ values ('isolation-clinic-beta'::text) $$,
  'User B can access Clinic Beta through active membership'
);

select results_eq(
  $$ select count(*)::bigint from public.clinic where clinic_code = 'isolation-clinic-alpha' $$,
  $$ values (0::bigint) $$,
  'User B cannot access Clinic Alpha'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.clinic $$,
  $$ values (0::bigint) $$,
  'a user without membership cannot access a clinic'
);

reset role;
select graftvision_private.clear_test_tenant_context();
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.platform_user $$,
  $$ values (0::bigint) $$,
  'clearing trusted context removes identity visibility'
);

reset role;
select graftvision_private.clear_test_tenant_context();
savepoint failed_request;
select graftvision_private.set_test_tenant_context(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
rollback to savepoint failed_request;
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.clinic $$,
  $$ values (0::bigint) $$,
  'a failed request transaction does not leave tenant context active'
);

reset role;

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('platform_user', 'clinic', 'clinic_membership')
  $$,
  $$ values (12::bigint) $$,
  'all tenant-foundation operations have explicit policies'
);

select results_eq(
  $$
    select indexdef
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'clinic_code_case_insensitive_unique'
  $$,
  $$
    values (
      'CREATE UNIQUE INDEX clinic_code_case_insensitive_unique ON public.clinic USING btree (lower(clinic_code))'::text
    )
  $$,
  'clinic code uniqueness uses a case-insensitive index'
);

select throws_ok(
  $$
    insert into public.clinic_membership (
      clinic_id,
      platform_user_id,
      membership_status
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      'active'
    )
  $$,
  '23505',
  null,
  'one user cannot have duplicate membership in the same clinic'
);

select results_eq(
  $$
    select confdeltype
    from pg_catalog.pg_constraint
    where conname in (
      'clinic_membership_clinic_fk',
      'clinic_membership_platform_user_fk'
    )
    order by conname
  $$,
  $$ values ('r'::"char"), ('r'::"char") $$,
  'tenant roots and identities use restrictive deletion relationships'
);

select * from finish();

rollback;
