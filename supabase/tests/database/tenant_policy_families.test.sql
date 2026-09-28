-- TENANT-002 reusable tenant constraint and RLS-family tests.
-- All product-like structures are temporary non-product fixtures and roll back with this test.

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

insert into public.platform_user (id, external_identity_id, status)
values
  ('51111111-1111-4111-8111-111111111111', 'family-user-alpha', 'active'),
  ('52222222-2222-4222-8222-222222222222', 'family-user-beta', 'active');

insert into public.clinic (id, clinic_code, display_name, status)
values
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'family-clinic-alpha', 'Family Clinic Alpha', 'active'),
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'family-clinic-beta', 'Family Clinic Beta', 'active');

insert into public.clinic_membership (
  id,
  clinic_id,
  platform_user_id,
  membership_status
)
values
  (
    '51111111-aaaa-4111-8111-111111111111',
    'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '51111111-1111-4111-8111-111111111111',
    'active'
  ),
  (
    '52222222-bbbb-4222-8222-222222222222',
    'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '52222222-2222-4222-8222-222222222222',
    'active'
  ),
  (
    '51111111-bbbb-4111-8111-111111111111',
    'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '51111111-1111-4111-8111-111111111111',
    'suspended'
  );

create temporary table tenant_boundary_parent_fixture (
  id uuid not null default gen_random_uuid(),
  clinic_id uuid not null,
  local_code text not null,
  fixture_status text not null default 'active'
    check (fixture_status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  primary key (id),
  unique (clinic_id, id),
  unique (clinic_id, local_code)
);

create temporary table tenant_boundary_child_fixture (
  id uuid not null default gen_random_uuid(),
  clinic_id uuid not null,
  parent_id uuid not null,
  local_code text not null,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  primary key (id),
  unique (clinic_id, id),
  unique (clinic_id, local_code),
  foreign key (clinic_id, parent_id)
    references tenant_boundary_parent_fixture (clinic_id, id)
    on update restrict on delete restrict
);

create trigger tenant_boundary_parent_fixture_immutable_clinic
before update of clinic_id on tenant_boundary_parent_fixture
for each row execute function graftvision_private.prevent_clinic_id_change();

create trigger tenant_boundary_child_fixture_immutable_clinic
before update of clinic_id on tenant_boundary_child_fixture
for each row execute function graftvision_private.prevent_clinic_id_change();

create trigger tenant_boundary_parent_fixture_updated_at
before update on tenant_boundary_parent_fixture
for each row execute function graftvision_private.set_updated_at();

create trigger tenant_boundary_child_fixture_updated_at
before update on tenant_boundary_child_fixture
for each row execute function graftvision_private.set_updated_at();

alter table tenant_boundary_parent_fixture enable row level security;
alter table tenant_boundary_parent_fixture force row level security;
alter table tenant_boundary_child_fixture enable row level security;
alter table tenant_boundary_child_fixture force row level security;

grant select, insert, update, delete on tenant_boundary_parent_fixture to authenticated;
grant select, insert, update, delete on tenant_boundary_child_fixture to authenticated;

create policy tenant_boundary_parent_fixture_select_active_tenant
on tenant_boundary_parent_fixture
for select
to authenticated
using (graftvision_private.tenant_row_is_accessible(clinic_id));

create policy tenant_boundary_child_fixture_select_active_tenant
on tenant_boundary_child_fixture
for select
to authenticated
using (graftvision_private.tenant_row_is_accessible(clinic_id));

insert into tenant_boundary_parent_fixture (id, clinic_id, local_code)
values
  (
    'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'shared-code'
  ),
  (
    'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'shared-code'
  );

select lives_ok(
  $$
    insert into tenant_boundary_child_fixture (
      id,
      clinic_id,
      parent_id,
      local_code
    )
    values (
      'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'child-alpha'
    )
  $$,
  'same-clinic composite parent-child relationship succeeds'
);

select throws_ok(
  $$
    insert into tenant_boundary_child_fixture (
      clinic_id,
      parent_id,
      local_code
    )
    values (
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'foreign-parent'
    )
  $$,
  '23503',
  null,
  'Clinic Alpha child cannot reference a Clinic Beta parent'
);

select throws_ok(
  $$
    update tenant_boundary_child_fixture
    set clinic_id = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id = 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  '23514',
  'clinic ownership is immutable',
  'child clinic ownership cannot change'
);

select throws_ok(
  $$
    update tenant_boundary_parent_fixture
    set clinic_id = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  '23514',
  'clinic ownership is immutable',
  'parent clinic ownership cannot change'
);

select lives_ok(
  $$
    update tenant_boundary_parent_fixture
    set clinic_id = clinic_id
    where id = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  'a no-op clinic ownership update is permitted'
);

select lives_ok(
  $$
    insert into tenant_boundary_parent_fixture (clinic_id, local_code)
    values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'repeatable-reference')
  $$,
  'a tenant-scoped unique value inserts in Clinic Alpha'
);

select lives_ok(
  $$
    insert into tenant_boundary_parent_fixture (clinic_id, local_code)
    values ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'repeatable-reference')
  $$,
  'the same tenant-scoped value may repeat in Clinic Beta'
);

select throws_ok(
  $$
    insert into tenant_boundary_parent_fixture (clinic_id, local_code)
    values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'repeatable-reference')
  $$,
  '23505',
  null,
  'a tenant-scoped value cannot repeat within Clinic Alpha'
);

select throws_ok(
  $$
    insert into tenant_boundary_parent_fixture (clinic_id, local_code, fixture_status)
    values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invalid-status', 'free text')
  $$,
  '23514',
  null,
  'controlled status check rejects arbitrary text'
);

select ok(
  (
    select created_at <= timezone('utc', statement_timestamp())
      and updated_at <= timezone('utc', statement_timestamp())
    from tenant_boundary_parent_fixture
    where id = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'fixture timestamps are database generated in UTC'
);

select lives_ok(
  $$
    update tenant_boundary_parent_fixture
    set local_code = 'changed-code'
    where id = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  'ordinary mutation uses the existing updated-at trigger'
);

select ok(
  (
    select updated_at >= created_at
    from tenant_boundary_parent_fixture
    where id = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'updated_at remains database controlled after mutation'
);

select results_eq(
  $$
    select relrowsecurity, relforcerowsecurity
    from pg_catalog.pg_class
    where oid in (
      'tenant_boundary_parent_fixture'::regclass,
      'tenant_boundary_child_fixture'::regclass
    )
    order by relname
  $$,
  $$ values (true, true), (true, true) $$,
  'fixture RLS is enabled and forced'
);

select graftvision_private.clear_test_tenant_context();
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from tenant_boundary_parent_fixture $$,
  $$ values (0::bigint) $$,
  'missing trusted context denies fixture rows'
);

select throws_ok(
  $$
    insert into tenant_boundary_parent_fixture (clinic_id, local_code)
    values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-supplied')
  $$,
  '42501',
  null,
  'client-supplied clinic_id does not grant insert authority'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '51111111-1111-4111-8111-111111111111',
  'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
set local role authenticated;

select results_eq(
  $$ select local_code from tenant_boundary_parent_fixture order by local_code $$,
  $$ values ('changed-code'::text), ('repeatable-reference'::text) $$,
  'active Clinic Alpha membership reads only Clinic Alpha fixtures'
);

select results_eq(
  $$
    select count(*)::bigint
    from tenant_boundary_parent_fixture
    where clinic_id = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  $$ values (0::bigint) $$,
  'Clinic Alpha cannot discover Clinic Beta fixtures'
);

reset role;
select graftvision_private.set_test_tenant_context(
  '51111111-1111-4111-8111-111111111111',
  'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from tenant_boundary_parent_fixture $$,
  $$ values (0::bigint) $$,
  'suspended Clinic Beta membership denies fixture rows'
);

reset role;
select graftvision_private.clear_test_tenant_context();

select lives_ok(
  $$
    select graftvision_private.set_tenant_context(
      '51111111-1111-4111-8111-111111111111',
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  $$,
  'trusted server establishes active tenant context'
);

select lives_ok(
  $$
    select graftvision_private.set_tenant_context(
      '51111111-1111-4111-8111-111111111111',
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  $$,
  'same actor and clinic context may be safely reused'
);

select throws_ok(
  $$
    select graftvision_private.set_tenant_context(
      '52222222-2222-4222-8222-222222222222',
      'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  '25001',
  'trusted tenant context cannot change within a transaction',
  'context cannot switch clinics or actors within one transaction'
);

select results_eq(
  $$
    select
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id()
  $$,
  $$
    values (
      '51111111-1111-4111-8111-111111111111'::uuid,
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    )
  $$,
  'a failed context switch preserves the original context'
);

select lives_ok(
  $$
    select graftvision_private.write_clinic_audit_event(
      'clinic.read',
      'clinic',
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'success',
      'tenant.family.verified',
      '80000000-0000-4000-8000-000000000001',
      'database',
      '{"policy_decision_code": "tenant.active"}'::jsonb
    )
  $$,
  'audit writing remains composable with the original context'
);

select results_eq(
  $$
    select clinic_id, actor_platform_user_id
    from public.audit_event
    where request_id = '80000000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      '51111111-1111-4111-8111-111111111111'::uuid
    )
  $$,
  'audit evidence uses the unchanged trusted tenant and actor'
);

select graftvision_private.clear_test_tenant_context();
savepoint failed_tenant_context;
select graftvision_private.set_tenant_context(
  '51111111-1111-4111-8111-111111111111',
  'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
rollback to savepoint failed_tenant_context;

select results_eq(
  $$
    select
      graftvision_private.current_platform_user_id(),
      graftvision_private.current_clinic_id()
  $$,
  $$ values (null::uuid, null::uuid) $$,
  'savepoint rollback does not leak tenant context'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'graftvision_private.set_tenant_context(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot establish trusted tenant context'
);

select ok(
  has_function_privilege(
    'authenticated',
    'graftvision_private.tenant_row_is_accessible(uuid)',
    'EXECUTE'
  ),
  'authenticated RLS evaluation may execute only the boolean tenant predicate'
);

select results_eq(
  $$
    select prosecdef, provolatile
    from pg_catalog.pg_proc
    where oid = 'graftvision_private.tenant_row_is_accessible(uuid)'::regprocedure
  $$,
  $$ values (false, 's'::"char") $$,
  'the reusable row predicate is stable security-invoker code'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('platform_user', 'clinic', 'clinic_membership', 'audit_event')
  $$,
  $$ values (12::bigint) $$,
  'existing tenant and audit policy counts remain unchanged'
);

select * from finish();

rollback;
