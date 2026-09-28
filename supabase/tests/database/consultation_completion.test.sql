begin;
select plan(5);

-- 1. Table existence and columns
select has_table('public', 'consultation_lifecycle_event', 'Table consultation_lifecycle_event should exist');

-- 2. Test RLS
select policies_are(
  'public', 'consultation_lifecycle_event',
  ARRAY[]::text[],
  'consultation_lifecycle_event should have no public policies, enforcing completely controlled access'
);

-- 3. Test direct insert blocked by controlled trigger
-- First, insert some test data just to try to trigger the controlled mutation error
insert into public.clinic (id, display_name, clinic_code, status, timezone) values
  ('c2000000-0000-4000-8000-000000000001', 'Clinic', 'clinic1', 'active', 'UTC');
insert into public.platform_user (id, external_identity_id, status) values
  ('c1000000-0000-4000-8000-000000000001', 'id1', 'active');
insert into public.patient (id, clinic_id, patient_number, status, provenance_code, created_by, updated_by) values
  ('c4000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'GV-123456', 'active', 'MANUAL_REGISTRATION', 'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001');
insert into public.consultation (id, clinic_id, patient_id, status, created_by, updated_by) values
  ('c6000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'in_progress', 'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001');

prepare try_direct_insert as
  insert into public.consultation_lifecycle_event(
    clinic_id, consultation_id, event_type, consultation_revision,
    actor_platform_user_id, request_id, reopen_reason_code
  ) values (
    'c2000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'reopened', 1,
    'c1000000-0000-4000-8000-000000000001', gen_random_uuid(), 'WORKFLOW_RECOVERY'
  );
set local graftvision.consultation_controlled = 'off';
select throws_ok(
  'try_direct_insert',
  '42501',
  'CONSULTATION_CONTROLLED_MUTATION_REQUIRED',
  'Direct insert should be blocked by consultation_controlled_mutation trigger'
);

-- 4. Test immutability for updates
-- We can bypass the insert trigger by setting graftvision.consultation_controlled = 'on'
set local graftvision.consultation_controlled = 'on';

insert into public.consultation_lifecycle_event(
    id, clinic_id, consultation_id, event_type, consultation_revision,
    actor_platform_user_id, request_id, reopen_reason_code
) values (
    '11111111-1111-1111-1111-111111111111', 'c2000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'reopened', 1,
    'c1000000-0000-4000-8000-000000000001', gen_random_uuid(), 'WORKFLOW_RECOVERY'
);

prepare try_direct_update as
  update public.consultation_lifecycle_event set reopen_reason_code = 'CLERICAL_CORRECTION' where id = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  'try_direct_update',
  '42501',
  'CONSULTATION_HISTORY_IMMUTABLE',
  'Direct update should be blocked by prevent_consultation_history_mutation trigger'
);

-- 5. Test immutability for deletes
prepare try_direct_delete as
  delete from public.consultation_lifecycle_event where id = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  'try_direct_delete',
  '42501',
  'CONSULTATION_HISTORY_IMMUTABLE',
  'Direct delete should be blocked by prevent_consultation_history_mutation trigger'
);

select * from finish();
rollback;
