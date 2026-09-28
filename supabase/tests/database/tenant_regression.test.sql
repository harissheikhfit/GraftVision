-- TENANT-004 comprehensive tenant-isolation regression suite.
-- All mutable fixtures and negative controls are transaction-local and roll back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(62);

-- Tenant visibility and invalid-context denial.

select graftvision_private.clear_test_tenant_context();
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'missing actor and clinic context deny tenant visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  null,
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'missing actor context denies tenant visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  null
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'missing clinic context denies tenant visibility'
);

reset role;
select set_config('graftvision.platform_user_id', 'invalid-context', true);
select set_config(
  'graftvision.clinic_id',
  '20000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'invalid actor context denies tenant visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '60000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'unknown actor context denies tenant visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'unknown clinic context denies tenant visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'wrong-clinic context does not grant Alpha Owner access to Clinic Beta'
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
  'Alpha Owner sees Clinic Alpha'
);

select is(
  (select count(*)::integer from public.clinic where clinic_code = 'clinic-beta'),
  0,
  'Alpha Owner never reads Clinic Beta'
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
  'Beta Owner sees Clinic Beta'
);

select is(
  (select count(*)::integer from public.clinic where clinic_code = 'clinic-alpha'),
  0,
  'Beta Owner never reads Clinic Alpha'
);

-- Membership-state denial and ordinary-write boundaries.

reset role;
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'suspended membership denies Clinic Alpha visibility'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '60000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'missing membership denies tenant visibility'
);

reset role;
savepoint inactive_actor_fixture;
update public.platform_user
set status = 'suspended'
where id = '10000000-0000-4000-8000-000000000001';
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'inactive platform user denies tenant visibility'
);

reset role;
rollback to savepoint inactive_actor_fixture;
savepoint inactive_clinic_fixture;
update public.clinic
set status = 'suspended'
where id = '20000000-0000-4000-8000-000000000001';
select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (select count(*)::integer from public.clinic),
  0,
  'inactive clinic denies tenant visibility'
);

reset role;
rollback to savepoint inactive_clinic_fixture;

select throws_ok(
  $$
    insert into public.clinic_membership (
      id,
      clinic_id,
      platform_user_id,
      membership_status
    )
    values (
      '60000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'active'
    )
  $$,
  '23505',
  null,
  'duplicate membership remains prohibited'
);

select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.clinic_membership (
      clinic_id,
      platform_user_id,
      membership_status
    )
    values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'active'
    )
  $$,
  '42501',
  null,
  'ordinary users cannot self-create memberships'
);

select results_eq(
  $$
    update public.clinic_membership
    set membership_status = 'suspended'
    where id = '30000000-0000-4000-8000-000000000001'
    returning id
  $$,
  $$ select id from public.clinic_membership where false $$,
  'ordinary users cannot change membership status'
);

select results_eq(
  $$
    update public.clinic_membership
    set clinic_id = '20000000-0000-4000-8000-000000000002'
    where id = '30000000-0000-4000-8000-000000000001'
    returning id
  $$,
  $$ select id from public.clinic_membership where false $$,
  'ordinary users cannot move a membership across clinics'
);

select throws_ok(
  $$
    insert into public.clinic (id, clinic_code, display_name)
    values (
      '60000000-0000-4000-8000-000000000004',
      'client-supplied-clinic',
      'Client Supplied Clinic'
    )
  $$,
  '42501',
  null,
  'client-supplied clinic identifiers never establish authority'
);

-- Trusted context mutation, savepoint, and privilege regression.

reset role;
select graftvision_private.clear_test_tenant_context();

select lives_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'trusted context accepts an active Alpha membership'
);

select lives_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'same actor and clinic context reuse is safe'
);

select throws_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  '25001',
  'trusted tenant context cannot change within a transaction',
  'trusted context cannot switch clinics mid-transaction'
);

select throws_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  '25001',
  'trusted tenant context cannot change within a transaction',
  'trusted context cannot switch actors mid-transaction'
);

savepoint context_switch_fixture;
select throws_ok(
  $$
    select graftvision_private.set_tenant_context(
      '10000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  '25001',
  null,
  'savepoint cannot introduce another tenant context'
);
rollback to savepoint context_switch_fixture;

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
  'savepoint failure preserves the original valid context'
);

set local role authenticated;
select throws_ok(
  $$ select graftvision_private.clear_test_tenant_context() $$,
  '42501',
  null,
  'ordinary callers cannot clear and replace protected context'
);
reset role;

-- Cross-tenant relationships and scoped uniqueness use rollback-only fixtures.

create schema tenant_regression_fixture;

create table tenant_regression_fixture.parent (
  id uuid primary key,
  clinic_id uuid not null,
  local_code text not null,
  unique (clinic_id, id),
  unique (clinic_id, local_code)
);

create table tenant_regression_fixture.child (
  id uuid primary key,
  clinic_id uuid not null,
  parent_id uuid not null,
  foreign key (clinic_id, parent_id)
    references tenant_regression_fixture.parent (clinic_id, id)
    on update restrict on delete restrict
);

create trigger parent_prevent_clinic_change
before update of clinic_id on tenant_regression_fixture.parent
for each row execute function graftvision_private.prevent_clinic_id_change();

create trigger child_prevent_clinic_change
before update of clinic_id on tenant_regression_fixture.child
for each row execute function graftvision_private.prevent_clinic_id_change();

insert into tenant_regression_fixture.parent (id, clinic_id, local_code)
values (
  '61000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'repeatable-code'
);

select lives_ok(
  $$
    insert into tenant_regression_fixture.child (id, clinic_id, parent_id)
    values (
      '62000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001'
    )
  $$,
  'same-clinic parent-child relationship succeeds'
);

select throws_ok(
  $$
    insert into tenant_regression_fixture.child (id, clinic_id, parent_id)
    values (
      '62000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503',
  null,
  'cross-clinic parent-child relationship fails'
);

select throws_ok(
  $$
    update tenant_regression_fixture.child
    set clinic_id = '20000000-0000-4000-8000-000000000002'
    where id = '62000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'clinic ownership is immutable',
  'child clinic ownership cannot change'
);

select throws_ok(
  $$
    update tenant_regression_fixture.parent
    set clinic_id = '20000000-0000-4000-8000-000000000002'
    where id = '61000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'clinic ownership is immutable',
  'parent clinic ownership cannot change'
);

select throws_ok(
  $$
    delete from tenant_regression_fixture.parent
    where id = '61000000-0000-4000-8000-000000000001'
  $$,
  '23503',
  null,
  'parent deletion remains restrictive while a child exists'
);

select lives_ok(
  $$
    insert into tenant_regression_fixture.parent (id, clinic_id, local_code)
    values (
      '61000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'repeatable-code'
    )
  $$,
  'tenant-scoped code may repeat across clinics'
);

select throws_ok(
  $$
    insert into tenant_regression_fixture.parent (id, clinic_id, local_code)
    values (
      '61000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'repeatable-code'
    )
  $$,
  '23505',
  null,
  'tenant-scoped code cannot repeat inside one clinic'
);

select has_index(
  'tenant_regression_fixture',
  'parent',
  'parent_clinic_id_id_key',
  'composite parent relationship index exists'
);

-- RLS catalogue and negative-control detection.

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
  'RLS remains enabled on every persistent foundation table'
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
  'RLS remains forced on every persistent foundation table'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ '^\s*true\s*$'
        or coalesce(with_check, '') ~ '^\s*true\s*$'
      )
  ),
  0,
  'persistent tenant policies contain no broad true predicate'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'graftvision_private'
      and pg_proc.proname in (
        'current_platform_user_id',
        'current_clinic_id',
        'has_active_clinic_membership',
        'set_tenant_context',
        'require_active_clinic_membership',
        'tenant_row_is_accessible',
        'prevent_clinic_id_change'
      )
      and not exists (
        select 1
        from unnest(coalesce(pg_proc.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
  ),
  0,
  'tenant security helpers pin a safe search path'
);

select is(
  has_function_privilege(
    'authenticated',
    'graftvision_private.set_tenant_context(uuid,uuid)',
    'execute'
  ),
  false,
  'authenticated role cannot establish trusted tenant context'
);

select is(
  has_function_privilege(
    'authenticated',
    'graftvision_private.tenant_row_is_accessible(uuid)',
    'execute'
  ),
  true,
  'authenticated role has only the required RLS predicate privilege'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.clinic $$,
  '42501',
  null,
  'unauthenticated role has no tenant-table access'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ alter table public.clinic disable row level security $$,
  '42501',
  null,
  'normal role cannot disable RLS'
);
select throws_ok(
  $$ alter policy clinic_select_active_tenant on public.clinic using (true) $$,
  '42501',
  null,
  'normal role cannot change tenant policies'
);
reset role;

create table tenant_regression_fixture.insecure_rls (
  id uuid primary key,
  clinic_id uuid not null
);
alter table tenant_regression_fixture.insecure_rls enable row level security;
grant select on tenant_regression_fixture.insecure_rls to authenticated;
create policy insecure_rls_broad_select
on tenant_regression_fixture.insecure_rls
for select
to authenticated
using (true);

select is(
  (
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'tenant_regression_fixture.insecure_rls'::regclass
  ),
  false,
  'negative control detects a table without forced RLS'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'tenant_regression_fixture'
      and tablename = 'insecure_rls'
      and coalesce(qual, '') ~ '^\s*true\s*$'
  ),
  1,
  'negative control detects a broad select policy'
);

create table tenant_regression_fixture.weak_parent (
  id uuid primary key,
  clinic_id uuid not null
);
create table tenant_regression_fixture.weak_child (
  id uuid primary key,
  clinic_id uuid not null,
  parent_id uuid not null references tenant_regression_fixture.weak_parent (id)
);
insert into tenant_regression_fixture.weak_parent (id, clinic_id)
values (
  '63000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
insert into tenant_regression_fixture.weak_child (id, clinic_id, parent_id)
values (
  '64000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '63000000-0000-4000-8000-000000000001'
);

select is(
  (
    select count(*)::integer
    from tenant_regression_fixture.weak_child child
    join tenant_regression_fixture.weak_parent parent on parent.id = child.parent_id
    where child.clinic_id <> parent.clinic_id
  ),
  1,
  'negative control detects a weakened cross-clinic foreign key'
);

select is(
  (
    select count(*)::integer
    from public.clinic_membership
    where platform_user_id = '10000000-0000-4000-8000-000000000005'
      and clinic_id = '20000000-0000-4000-8000-000000000001'
  ),
  1,
  'negative control proves a status-blind membership lookup is insecure'
);

select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001'
);

select is(
  graftvision_private.has_active_clinic_membership(
    '20000000-0000-4000-8000-000000000001'
  ),
  false,
  'approved membership predicate rejects the same suspended fixture'
);

-- Audit scope, rollback, ordinary-access, and metadata regression.

select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);

select lives_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      '20000000-0000-4000-8000-000000000002',
      'success',
      null,
      '91000000-0000-4000-8000-000000000001',
      'database',
      '{}'::jsonb
    )
  $$,
  'valid audit event accepts trusted Alpha context'
);

select results_eq(
  $$
    select clinic_id, actor_platform_user_id
    from public.audit_event
    where request_id = '91000000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      '20000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'audit clinic and actor derive from trusted Alpha context'
);

select is(
  (
    select count(*)::integer
    from public.audit_event
    where request_id = '91000000-0000-4000-8000-000000000001'
      and clinic_id = '20000000-0000-4000-8000-000000000002'
  ),
  0,
  'Alpha cannot create Beta-scoped audit evidence through resource input'
);

savepoint failed_audit_fixture;
select graftvision_private.write_clinic_audit_event(
  'clinic.read',
  'clinic',
  '20000000-0000-4000-8000-000000000001',
  'success',
  null,
  '91000000-0000-4000-8000-000000000002',
  'database',
  '{}'::jsonb
);
rollback to savepoint failed_audit_fixture;

select is(
  (
    select count(*)::integer
    from public.audit_event
    where request_id = '91000000-0000-4000-8000-000000000002'
  ),
  0,
  'failed protected transaction leaves no audit evidence'
);

select graftvision_private.clear_test_tenant_context();
select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      '91000000-0000-4000-8000-000000000003',
      'database',
      '{}'::jsonb
    )
  $$,
  '42501',
  'audit tenant context is required',
  'missing context cannot write an audit event'
);

select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      '91000000-0000-4000-8000-000000000004',
      'database',
      '{}'::jsonb
    )
  $$,
  '42501',
  'audit tenant context is not authorised',
  'suspended membership cannot write an audit event'
);

select graftvision_private.set_test_tenant_context(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      null,
      'success',
      null,
      '91000000-0000-4000-8000-000000000005',
      'database',
      '{"email":"not-allowed@example.test"}'::jsonb
    )
  $$,
  '22023',
  null,
  'audit metadata protections remain active'
);

set local role authenticated;
select throws_ok(
  $$ select count(*) from public.audit_event $$,
  '42501',
  null,
  'ordinary user cannot read audit rows'
);

select throws_ok(
  $$
    update public.audit_event
    set outcome = 'failure'
    where request_id = '91000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'ordinary user cannot mutate audit rows'
);
reset role;

-- Seed and migration invariants remain stable inside the full regression gate.

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
  'synthetic fixture counts remain deterministic'
);

select is(
  (
    select count(*)::integer
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
      and external_identity_id like '%@example.test'
  ),
  5,
  'all deterministic synthetic identities use example.test'
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
  'synthetic seed has no unexpected membership'
);

select results_eq(
  $$
    select version
    from supabase_migrations.schema_migrations
    where version in (
      '20260731000000',
      '20260731000001',
      '20260731082044'
    )
  $$,
  $$ values ('20260731000000'::text), ('20260731000001'::text), ('20260731082044'::text) $$,
  'migration history includes the current foundation migrations'
);

select * from finish();

rollback;
