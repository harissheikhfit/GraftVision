begin;
select plan(19);

-- Setup test roles
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'doc1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'asst1@example.com');

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('11111111-0000-0000-0000-000000000001', 'test-clinic', 'Test Clinic', 'active', 'Asia/Karachi');

insert into public.platform_user (id, external_identity_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'id1', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'id2', 'active');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('11111111-1000-1000-1000-100010001000', '11111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active'),
  ('11111111-2000-2000-2000-200020002000', '11111111-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('11111111-1000-1000-1000-100010001000', 'DOCTOR'),
  ('11111111-1000-1000-1000-100010001000', 'CLINIC_OWNER'),
  ('11111111-2000-2000-2000-200020002000', 'CLINICAL_ASSISTANT');

select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values (
  '11111111-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'verified', clock_timestamp(), clock_timestamp() + interval '1 year'
);
select set_config('graftvision.doctor_verification_transition','denied',true);

select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('11111111-0000-0000-0000-000000000001', 'SECURITY_READY', 'attested', '11111111-1111-1111-1111-111111111111', 1),
  ('11111111-0000-0000-0000-000000000001', 'PROTOCOL_TEMPLATE_READY', 'attested', '11111111-1111-1111-1111-111111111111', 1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient (
  id, clinic_id, patient_number, status, provenance_code, created_by, updated_by
) values (
  '11111111-2222-2222-2222-222222222222', '11111111-0000-0000-0000-000000000001', 'GV-000001', 'active', 'MANUAL_REGISTRATION', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'
);
select set_config('graftvision.patient_controlled','off',true);

select set_config('graftvision.consultation_controlled','on',true);
insert into public.consultation (id, clinic_id, patient_id, status, created_by, updated_by, revision) values
  ('11111111-3333-3333-3333-333333333333', '11111111-0000-0000-0000-000000000001', '11111111-2222-2222-2222-222222222222', 'in_progress', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1);

insert into public.consultation_assignment (clinic_id, consultation_id, doctor_platform_user_id, assigned_by, updated_by) values
  ('11111111-0000-0000-0000-000000000001', '11111111-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
select set_config('graftvision.consultation_controlled','off',true);

select graftvision_private.create_application_session(
  '11111111-1111-1111-1111-111111111111', 'clinic', '11111111-0000-0000-0000-000000000001',
  '11111111-4444-4444-4444-444444444444', clock_timestamp() + interval '1 hour', 'test-device', null
) doctor_session \gset
select graftvision_private.create_application_session(
  '22222222-2222-2222-2222-222222222222', 'clinic', '11111111-0000-0000-0000-000000000001',
  '22222222-4444-4444-4444-444444444444', clock_timestamp() + interval '1 hour', 'test-device-2', null
) asst_session \gset

-- Add medical and hair history bindings
insert into public.patient_medical_history (id, clinic_id, patient_id, revision, review_state, updated_by) values
  ('11111111-5555-5555-5555-555555555555', '11111111-0000-0000-0000-000000000001', '11111111-2222-2222-2222-222222222222', 1, 'doctor_reviewed', '11111111-1111-1111-1111-111111111111');

insert into public.patient_medical_history_version (
  id, clinic_id, history_id, patient_id, version,
  medical_condition_status, allergy_status, medication_status,
  previous_operation_status, anaesthesia_issue_status,
  bleeding_concern_status, healing_concern_status,
  source_code, certainty_code, material_change,
  created_by
) values (
  '11111111-6666-6666-6666-666666666666', '11111111-0000-0000-0000-000000000001',
  '11111111-5555-5555-5555-555555555555', '11111111-2222-2222-2222-222222222222', 1,
  'no_known_significant_condition', 'none_reported', 'none_reported',
  'none_reported', 'none_reported',
  'none_reported', 'none_reported',
  'patient_reported', 'reported', false,
  '11111111-1111-1111-1111-111111111111'
);

insert into public.consultation_hair_loss_history (id, clinic_id, consultation_id, revision, review_state, updated_by) values
  ('11111111-7777-7777-7777-777777777777', '11111111-0000-0000-0000-000000000001', '11111111-3333-3333-3333-333333333333', 1, 'doctor_reviewed', '11111111-1111-1111-1111-111111111111');

insert into public.consultation_hair_loss_history_version (
  id, clinic_id, history_id, consultation_id, version,
  primary_concern, onset_kind, progression,
  previous_hair_procedure_status, pattern_classification, scalp_symptom_status,
  source_code, certainty_code, material_change,
  created_by
) values (
  '11111111-8888-8888-8888-888888888888', '11111111-0000-0000-0000-000000000001',
  '11111111-7777-7777-7777-777777777777', '11111111-3333-3333-3333-333333333333', 1,
  'frontal_recession', 'uncertain', 'stable',
  'none_reported', 'unclassified', 'none_reported',
  'patient_reported', 'reported', false,
  '11111111-1111-1111-1111-111111111111'
);

update public.patient_medical_history set current_version_id = '11111111-6666-6666-6666-666666666666';
update public.consultation_hair_loss_history set current_version_id = '11111111-8888-8888-8888-888888888888';

-- Test 1: Function exists
select ok(exists (
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'graftvision_private' and p.proname = 'save_preliminary_assessment'
), 'save_preliminary_assessment exists');
select ok(exists (
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'graftvision_private' and p.proname = 'transition_preliminary_assessment_review'
), 'transition_preliminary_assessment_review exists');
select ok(exists (
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'graftvision_private' and p.proname = 'read_preliminary_assessment'
), 'read_preliminary_assessment exists');

-- Test 2: Cannot be used by assistant
select throws_like(
  format($sql$ select graftvision_private.save_preliminary_assessment(
    %L::uuid, '22222222-2222-2222-2222-222222222222', '11111111-3333-3333-3333-333333333333',
    0, gen_random_uuid(), '11111111-6666-6666-6666-666666666666', '11111111-8888-8888-8888-888888888888', 1,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
  ) $sql$, :'asst_session'),
  '%PRELIMINARY_ASSESSMENT_ACCESS_DENIED%',
  'Assistant cannot save preliminary assessment'
);

-- Test 3: Doctor can save
select lives_ok(
  format($sql$ select graftvision_private.save_preliminary_assessment(
    %L::uuid, '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333',
    0, gen_random_uuid(), '11111111-6666-6666-6666-666666666666', '11111111-8888-8888-8888-888888888888', 1,
    'Hamilton-Norwood Type III', 'observed', 'clinician_observed', null,
    'yes', 'yes', 'no', 'no', 'no', null,
    'none_reported', 'none_reported', 'none_reported', null,
    null, null, 'none', 'none', array[]::text[], null
  ) $sql$, :'doctor_session'),
  'Doctor can save preliminary assessment'
);

select current_version_id as version_id from public.preliminary_assessment where consultation_id = '11111111-3333-3333-3333-333333333333';
\gset prev_

-- Test 4: Cannot transition with Assistant (unauthorized)
select throws_like(
  format($sql$ select graftvision_private.transition_preliminary_assessment_review(
    %L::uuid, '22222222-2222-2222-2222-222222222222', '11111111-3333-3333-3333-333333333333',
    1, gen_random_uuid(), 'doctor_reviewed', null
  ) $sql$, :'asst_session'),
  '%PRELIMINARY_ASSESSMENT_ACCESS_DENIED%',
  'Assistant cannot transition review state'
);

-- Test 4.1: Can transition to doctor_reviewed (creates new version)
select * from graftvision_private.transition_preliminary_assessment_review(
  :'doctor_session', '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333',
  1, '11111111-9999-9999-9999-999999999999', 'doctor_reviewed', null
);

-- Capture new state
select current_version_id as version_id, revision from public.preliminary_assessment where consultation_id = '11111111-3333-3333-3333-333333333333';
\gset new_

-- Test 4.2: Old version remains draft and unchanged
select results_eq(
  format('select review_state from public.preliminary_assessment_version where id = %L', :'prev_version_id'),
  $$values ('draft')$$,
  'Old version remains draft'
);

-- Test 4.3: New version is doctor_reviewed
select results_eq(
  format('select review_state from public.preliminary_assessment_version where id = %L', :'new_version_id'),
  $$values ('doctor_reviewed')$$,
  'New version is doctor_reviewed'
);

-- Test 4.4: Root pointer moves to new version
select ok(:'prev_version_id' <> :'new_version_id', 'Root pointer moved to new version');

-- Test 4.5: Root revision increments once
select is(:'new_revision'::integer, 2, 'Root revision increments to 2');

-- Test 4.6: Supersedes version points to old version
select results_eq(
  format('select supersedes_version_id from public.preliminary_assessment_version where id = %L', :'new_version_id'),
  format('values (%L::uuid)', :'prev_version_id'),
  'Supersedes version ID points to previous version'
);

-- Test 4.7: Replay idempotency key returns exact same revision/version without inserting
select results_eq(
  format($sql$ select outcome_code, revision from graftvision_private.transition_preliminary_assessment_review(
    %L::uuid, '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333',
    1, '11111111-9999-9999-9999-999999999999', 'doctor_reviewed', null
  ) $sql$, :'doctor_session'),
  $$values ('success', 2)$$,
  'Idempotent replay returns original result'
);

-- Verify no new rows created by checking count
select results_eq(
  $$select count(*)::integer from public.preliminary_assessment_version where consultation_id = '11111111-3333-3333-3333-333333333333'$$,
  $$values (2::integer)$$,
  'Replay does not duplicate versions'
);

-- Test 4.8: Stale revision does not mutate anything
select results_eq(
  format($sql$ select outcome_code from graftvision_private.transition_preliminary_assessment_review(
    %L::uuid, '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333',
    1, gen_random_uuid(), 'superseded', null
  ) $sql$, :'doctor_session'),
  $$values ('stale_revision')$$,
  'Stale revision returns stale conflict'
);


-- Test 5: Can read assessment
select results_eq(
  format($sql$ select review_state from graftvision_private.read_preliminary_assessment(
    %L::uuid, '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333'
  ) $sql$, :'doctor_session'),
  $$ values ('doctor_reviewed') $$,
  'Can read assessment'
);

-- Test 6: Assistant can also read
select results_eq(
  format($sql$ select review_state from graftvision_private.read_preliminary_assessment(
    %L::uuid, '22222222-2222-2222-2222-222222222222', '11111111-3333-3333-3333-333333333333'
  ) $sql$, :'asst_session'),
  $$ values ('doctor_reviewed') $$,
  'Assistant can read assessment'
);

-- Test 7: New medical history makes assessment stale
reset role;
alter table public.preliminary_assessment_version disable trigger immutable_preliminary_assessment_version;
insert into public.patient_medical_history_version (id, clinic_id, history_id, patient_id, version, medical_condition_status, allergy_status, medication_status, previous_operation_status, anaesthesia_issue_status, bleeding_concern_status, healing_concern_status, source_code, certainty_code, material_change, created_by) values
  ('11111111-9999-9999-9999-999999999999', '11111111-0000-0000-0000-000000000001', '11111111-5555-5555-5555-555555555555', '11111111-2222-2222-2222-222222222222', 2, 'condition_reported', 'none_reported', 'none_reported', 'none_reported', 'none_reported', 'none_reported', 'none_reported', 'patient_reported', 'reported', true, '11111111-1111-1111-1111-111111111111');
update public.patient_medical_history set current_version_id = '11111111-9999-9999-9999-999999999999' where id = '11111111-5555-5555-5555-555555555555';
alter table public.preliminary_assessment_version enable trigger immutable_preliminary_assessment_version;

select results_eq(
  format($sql$ select downstream_stale from graftvision_private.read_preliminary_assessment(
    %L::uuid, '11111111-1111-1111-1111-111111111111', '11111111-3333-3333-3333-333333333333'
  ) $sql$, :'doctor_session'),
  $$ values (true) $$,
  'Assessment becomes stale when medical history gets a new version'
);

-- Test 8: Modifying preliminary_assessment_version throws exception
select throws_like(
  $$ update public.preliminary_assessment_version set pattern_classification = 'modified' $$,
  '%CLINICAL_HISTORY_IMMUTABLE%',
  'Modifying preliminary_assessment_version is prevented'
);

-- Test 9: Modifying preliminary_assessment_event throws exception
select throws_like(
  $$ update public.preliminary_assessment_event set action = 'modified' $$,
  '%CLINICAL_HISTORY_IMMUTABLE%',
  'Modifying preliminary_assessment_event is prevented'
);

select * from finish();
rollback;
