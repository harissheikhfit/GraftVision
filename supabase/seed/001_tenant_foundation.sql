-- GraftVision synthetic seed
-- Task: TENANT-003
-- Scope: Disposable local/test tenant fixtures only.
-- Safety: No credentials, Auth identities, roles, patient data, clinical data, or audit events.
-- Ownership markers:
-- - platform users: 10000000-0000-4000-8000-000000000001 through ...0005
-- - clinics:        20000000-0000-4000-8000-000000000001 through ...0002
-- - memberships:    30000000-0000-4000-8000-000000000001 through ...0005
-- - identities:     reserved .example.test values
-- - clinic codes:   clinic-alpha and clinic-beta
--
-- Supabase applies this file after migrations during the explicitly local db:reset command.
-- The standalone db:seed runner independently enforces environment, host, and project markers.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  required_table text;
begin
  if current_database() <> 'postgres' then
    raise exception using
      errcode = '55000',
      message = 'synthetic seed requires the disposable local database';
  end if;

  foreach required_table in array array[
    'public.platform_user',
    'public.clinic',
    'public.clinic_membership',
    'public.audit_event'
  ]
  loop
    if to_regclass(required_table) is null then
      raise exception using
        errcode = '55000',
        message = 'synthetic seed schema prerequisite is missing';
    end if;
  end loop;

  if exists (
    select 1
    from (
      values
        ('10000000-0000-4000-8000-000000000001'::uuid, 'owner.alpha@example.test', 'active'),
        ('10000000-0000-4000-8000-000000000002'::uuid, 'staff.alpha@example.test', 'active'),
        ('10000000-0000-4000-8000-000000000003'::uuid, 'owner.beta@example.test', 'active'),
        ('10000000-0000-4000-8000-000000000004'::uuid, 'staff.beta@example.test', 'active'),
        ('10000000-0000-4000-8000-000000000005'::uuid, 'suspended.alpha@example.test', 'active')
    ) as expected(id, external_identity_id, status)
    join public.platform_user actual on actual.id = expected.id
    where actual.external_identity_id is distinct from expected.external_identity_id
      or actual.status is distinct from expected.status
  ) or exists (
    select 1
    from (
      values
        ('10000000-0000-4000-8000-000000000001'::uuid, 'owner.alpha@example.test'),
        ('10000000-0000-4000-8000-000000000002'::uuid, 'staff.alpha@example.test'),
        ('10000000-0000-4000-8000-000000000003'::uuid, 'owner.beta@example.test'),
        ('10000000-0000-4000-8000-000000000004'::uuid, 'staff.beta@example.test'),
        ('10000000-0000-4000-8000-000000000005'::uuid, 'suspended.alpha@example.test')
    ) as expected(id, external_identity_id)
    join public.platform_user actual
      on actual.external_identity_id = expected.external_identity_id
    where actual.id <> expected.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'synthetic seed platform-user identity conflict';
  end if;

  if exists (
    select 1
    from (
      values
        (
          '20000000-0000-4000-8000-000000000001'::uuid,
          'clinic-alpha',
          'Clinic Alpha',
          'active'
        ),
        (
          '20000000-0000-4000-8000-000000000002'::uuid,
          'clinic-beta',
          'Clinic Beta',
          'active'
        )
    ) as expected(id, clinic_code, display_name, status)
    join public.clinic actual on actual.id = expected.id
    where actual.clinic_code is distinct from expected.clinic_code
      or actual.display_name is distinct from expected.display_name
      or actual.status is distinct from expected.status
      or actual.archived_at is not null
  ) or exists (
    select 1
    from (
      values
        ('20000000-0000-4000-8000-000000000001'::uuid, 'clinic-alpha'),
        ('20000000-0000-4000-8000-000000000002'::uuid, 'clinic-beta')
    ) as expected(id, clinic_code)
    join public.clinic actual on lower(actual.clinic_code) = lower(expected.clinic_code)
    where actual.id <> expected.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'synthetic seed clinic identity conflict';
  end if;

  if exists (
    select 1
    from (
      values
        (
          '30000000-0000-4000-8000-000000000001'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000001'::uuid,
          'active'
        ),
        (
          '30000000-0000-4000-8000-000000000002'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000002'::uuid,
          'active'
        ),
        (
          '30000000-0000-4000-8000-000000000003'::uuid,
          '20000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000003'::uuid,
          'active'
        ),
        (
          '30000000-0000-4000-8000-000000000004'::uuid,
          '20000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000004'::uuid,
          'active'
        ),
        (
          '30000000-0000-4000-8000-000000000005'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000005'::uuid,
          'suspended'
        )
    ) as expected(id, clinic_id, platform_user_id, membership_status)
    join public.clinic_membership actual on actual.id = expected.id
    where actual.clinic_id is distinct from expected.clinic_id
      or actual.platform_user_id is distinct from expected.platform_user_id
      or actual.membership_status is distinct from expected.membership_status
  ) or exists (
    select 1
    from (
      values
        (
          '30000000-0000-4000-8000-000000000001'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000001'::uuid
        ),
        (
          '30000000-0000-4000-8000-000000000002'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000002'::uuid
        ),
        (
          '30000000-0000-4000-8000-000000000003'::uuid,
          '20000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000003'::uuid
        ),
        (
          '30000000-0000-4000-8000-000000000004'::uuid,
          '20000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000004'::uuid
        ),
        (
          '30000000-0000-4000-8000-000000000005'::uuid,
          '20000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000005'::uuid
        )
    ) as expected(id, clinic_id, platform_user_id)
    join public.clinic_membership actual
      on actual.clinic_id = expected.clinic_id
      and actual.platform_user_id = expected.platform_user_id
    where actual.id <> expected.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'synthetic seed membership identity conflict';
  end if;
end;
$$;

insert into public.platform_user (id, external_identity_id, status)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'owner.alpha@example.test',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'staff.alpha@example.test',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'owner.beta@example.test',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'staff.beta@example.test',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'suspended.alpha@example.test',
    'active'
  )
on conflict (id) do nothing;

insert into public.clinic (id, clinic_code, display_name, status)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'clinic-alpha',
    'Clinic Alpha',
    'active'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'clinic-beta',
    'Clinic Beta',
    'active'
  )
on conflict (id) do nothing;

insert into public.clinic_membership (
  id,
  clinic_id,
  platform_user_id,
  membership_status
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000004',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'suspended'
  )
on conflict (id) do nothing;

do $$
begin
  if (
    select count(*)
    from public.platform_user
    where id::text like '10000000-0000-4000-8000-00000000000_'
  ) <> 5
    or (
      select count(*)
      from public.clinic
      where id::text like '20000000-0000-4000-8000-00000000000_'
    ) <> 2
    or (
      select count(*)
      from public.clinic_membership
      where id::text like '30000000-0000-4000-8000-00000000000_'
    ) <> 5 then
    raise exception using
      errcode = '55000',
      message = 'synthetic seed did not reach the expected deterministic state';
  end if;
end;
$$;

commit;
