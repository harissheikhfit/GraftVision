-- SCAN-001 scan session lifecycle and pairing tests. Synthetic data only.
begin;
select plan(28);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('c2000000-0000-4000-8000-000000000001','scan-a','Synthetic Scan Clinic A','active','Asia/Karachi'),
  ('c2000000-0000-4000-8000-000000000002','scan-b','Synthetic Scan Clinic B','active','Asia/Karachi');

insert into public.platform_user (id, external_identity_id, status) values
  ('c1000000-0000-4000-8000-000000000001','c9000000-0000-4000-8000-000000000001','active'),
  ('c1000000-0000-4000-8000-000000000002','c9000000-0000-4000-8000-000000000002','active');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','active'),
  ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('c3000000-0000-4000-8000-000000000001','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000002','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000002','CLINIC_OWNER');

insert into public.permission_definition (permission_id) values ('CONSULT-PERM-001')
  on conflict do nothing;
insert into public.role_permission (role_code, permission_id) values ('DOCTOR', 'CONSULT-PERM-001')
  on conflict do nothing;

select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values (
  'c5000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'verified', clock_timestamp(), clock_timestamp() + interval '1 year'
), (
  'c5000000-0000-4000-8000-000000000002',
  'c2000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'verified', clock_timestamp(), clock_timestamp() + interval '1 year'
);
select set_config('graftvision.doctor_verification_transition','denied',true);

select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('c2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000002',1),
  ('c2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000002',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient (id, clinic_id, patient_number, status, provenance_code, created_by, updated_by) values
  ('c4000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'GV-000001', 'active', 'MANUAL_REGISTRATION', 'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('c4000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'GV-000002', 'active', 'MANUAL_REGISTRATION', 'c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002');
select set_config('graftvision.patient_controlled','off',true);

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000001', 'clinic', 'c2000000-0000-4000-8000-000000000001',
  'c8000000-0000-4000-8000-000000000001', clock_timestamp() + interval '1 hour', 'test-device', null
) doc_session1 \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000002', 'clinic', 'c2000000-0000-4000-8000-000000000002',
  'c8000000-0000-4000-8000-000000000002', clock_timestamp() + interval '1 hour', 'test-device-2', null
) doc_session2 \gset

select * from graftvision_private.create_consultation(
  :'doc_session1', 'c1000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001', gen_random_uuid()
)
\gset syn_
select * from graftvision_private.assign_consultation_doctor(
  :'doc_session1', 'c1000000-0000-4000-8000-000000000001',
  :'syn_id'::uuid, 'c1000000-0000-4000-8000-000000000001', 1,
  'INITIAL_ASSIGNMENT', gen_random_uuid()
);
select * from graftvision_private.transition_consultation_status(
  :'doc_session1', 'c1000000-0000-4000-8000-000000000001',
  :'syn_id'::uuid, 2, 'in_progress', 'PREPARATION_STARTED', gen_random_uuid()
);

select set_config('graftvision.test_doc_session1', :'doc_session1', false);
select set_config('graftvision.test_doc_session2', :'doc_session2', false);
select set_config('graftvision.test_consultation_id', :'syn_id', false);

insert into public.patient_medical_history (id, clinic_id, patient_id, revision, review_state, updated_by) values
  ('c7000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 1, 'doctor_reviewed', 'c1000000-0000-4000-8000-000000000001');
insert into public.patient_medical_history_version (
  id, clinic_id, history_id, patient_id, version,
  medical_condition_status, allergy_status, medication_status, previous_operation_status,
  anaesthesia_issue_status, bleeding_concern_status, healing_concern_status,
  source_code, certainty_code, material_change, created_by
) values (
  'c7000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 1,
  'no_known_significant_condition', 'none_reported', 'none_reported', 'none_reported',
  'none_reported', 'none_reported', 'none_reported',
  'patient_reported', 'reported', false, 'c1000000-0000-4000-8000-000000000001'
);
update public.patient_medical_history set current_version_id = 'c7000000-0000-4000-8000-000000000002';

insert into public.consultation_hair_loss_history (id, clinic_id, consultation_id, revision, review_state, updated_by) values
  ('c7000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000001', :'syn_id'::uuid, 1, 'doctor_reviewed', 'c1000000-0000-4000-8000-000000000001');
insert into public.consultation_hair_loss_history_version (
  id, clinic_id, history_id, consultation_id, version,
  primary_concern, onset_kind, progression, previous_hair_procedure_status,
  pattern_classification, scalp_symptom_status, source_code, certainty_code,
  material_change, created_by
) values (
  'c7000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000011', :'syn_id'::uuid, 1,
  'frontal_recession', 'uncertain', 'stable', 'none_reported',
  'unclassified', 'none_reported', 'patient_reported', 'reported',
  false, 'c1000000-0000-4000-8000-000000000001'
);
update public.consultation_hair_loss_history set current_version_id = 'c7000000-0000-4000-8000-000000000012';

insert into public.preliminary_assessment (id, clinic_id, consultation_id, revision, review_state, updated_by) values
  ('c7000000-0000-4000-8000-000000000021', 'c2000000-0000-4000-8000-000000000001', :'syn_id'::uuid, 1, 'doctor_reviewed', 'c1000000-0000-4000-8000-000000000001');
insert into public.preliminary_assessment_version (id, clinic_id, assessment_id, consultation_id, version, patient_medical_history_version_id, consultation_hair_loss_history_version_id, consultation_revision, created_by, downstream_stale, review_state) values
  ('c7000000-0000-4000-8000-000000000022', 'c2000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000021', :'syn_id'::uuid, 1, 'c7000000-0000-4000-8000-000000000002', 'c7000000-0000-4000-8000-000000000012', 2, 'c1000000-0000-4000-8000-000000000001', false, 'doctor_reviewed');
update public.preliminary_assessment set current_version_id = 'c7000000-0000-4000-8000-000000000022';

select * from graftvision_private.complete_consultation(
  :'doc_session1', 'c1000000-0000-4000-8000-000000000001',
  :'syn_id'::uuid, 3, gen_random_uuid()
);



-- We test backend service functionality which expects to execute graftvision_private functions as postgres
reset role;

select ok(
  exists (
    select 1
    from public.patient
    where id = 'c4000000-0000-4000-8000-000000000001'::uuid
      and clinic_id = 'c2000000-0000-4000-8000-000000000001'::uuid
  ),
  'Clinic A patient fixture exists before scan-session creation'
);

select is(
  (select graftvision_private.has_permission(
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'c2000000-0000-4000-8000-000000000001'::uuid,
    'SCAN-PERM-001'
  )),
  true,
  'scan session execution uses the authoritative SCAN-PERM-001 grant'
);

-- 1. Create a scan session
select results_eq(
  $$
    select scan_session_id, is_new
    from graftvision_private.create_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'c4000000-0000-4000-8000-000000000001'::uuid,
      current_setting('graftvision.test_consultation_id')::uuid,
      'token-hash-1',
      clock_timestamp() + interval '15 minutes',
      'a9000000-0000-4000-8000-000000000001'
    ) s
  $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, true) $$,
  'create_scan_session establishes a valid scan session'
);

select is(
  (select status from public.scan_session where id = 'a1000000-0000-4000-8000-000000000001'),
  'created'::text,
  'create_scan_session establishes a valid scan session status'
);

select is(
  (select count(*) from public.scan_session_event where scan_session_id = 'a1000000-0000-4000-8000-000000000001' and event_type = 'created'),
  1::bigint,
  'create_scan_session creates a created event'
);

-- 2. Idempotent create
select results_eq(
  $$
    select revision, is_new
    from graftvision_private.create_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'c4000000-0000-4000-8000-000000000001'::uuid,
      current_setting('graftvision.test_consultation_id')::uuid,
      'token-hash-1',
      clock_timestamp() + interval '15 minutes',
      'a9000000-0000-4000-8000-000000000001'
    )
  $$,
  $$ values (1, false) $$,
  'create_scan_session is idempotent and returns the original revision and is_new false'
);

-- 3. Expiry test
select results_eq(
  $$
    select scan_session_id, is_new
    from graftvision_private.create_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000002'::uuid,
      'c4000000-0000-4000-8000-000000000001'::uuid,
      current_setting('graftvision.test_consultation_id')::uuid,
      'token-hash-2',
      clock_timestamp() - interval '1 minute',
      'a9000000-0000-4000-8000-000000000002'
    ) s
  $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid, true) $$,
  'can create an already-expired session for testing'
);

select is(
  (select status from public.scan_session where id = 'a1000000-0000-4000-8000-000000000002'),
  'created'::text,
  'expired session has status created'
);

select throws_ok(
  $$
    select * from graftvision_private.pair_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000002'::uuid,
      'nonce-2',
      'a9000000-0000-4000-8000-000000000003'
    )
  $$,
  '40001',
  'SCAN_SESSION_EXPIRED',
  'pair_scan_session fails if the session is expired'
);

-- 4. Pair scan session
select results_eq(
  $$
    select status
    from graftvision_private.pair_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'nonce-1',
      'a9000000-0000-4000-8000-000000000004'
    ) s
  $$,
  $$ values ('paired'::text) $$,
  'pair_scan_session succeeds on a valid created session'
);

select is(
  (select pairing_nonce from public.scan_session where id = 'a1000000-0000-4000-8000-000000000001'),
  'nonce-1'::text,
  'pair_scan_session persists the pairing nonce'
);

-- 4b. QR-token redemption resolves only the matching controlled session.
select * from graftvision_private.create_scan_session(
  current_setting('graftvision.test_doc_session1')::uuid,
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000004'::uuid,
  'c4000000-0000-4000-8000-000000000001'::uuid,
  current_setting('graftvision.test_consultation_id')::uuid,
  'redeem-token-hash-012345678901234567890123456789',
  clock_timestamp() + interval '15 minutes',
  'a9000000-0000-4000-8000-000000000010'
);

select results_eq(
  $$
    select status from graftvision_private.redeem_scan_session_token(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'redeem-token-hash-012345678901234567890123456789',
      'abcdefghijklmnopqrstuvwxyz0123456789',
      'a9000000-0000-4000-8000-000000000011'
    )
  $$,
  $$ values ('paired'::text) $$,
  'redeem_scan_session_token pairs only the session addressed by its token hash'
);

select throws_ok(
  $$
    select * from graftvision_private.redeem_scan_session_token(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'redeem-token-hash-012345678901234567890123456789',
      'abcdefghijklmnopqrstuvwxyz0123456789',
      'a9000000-0000-4000-8000-000000000012'
    )
  $$,
  '40001',
  'INVALID_LIFECYCLE_TRANSITION',
  'redeem_scan_session_token rejects one-time token reuse'
);

-- 5. Transition scan session status
select is(
  (select current_step from public.scan_capture_state where scan_session_id = 'a1000000-0000-4000-8000-000000000001'),
  'preparation'::text,
  'pairing creates a resumable preparation capture state'
);

select results_eq(
  $$ select current_step from graftvision_private.record_scan_capture_step(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid, 'preparation', 'complete', 1,
    'a9000000-0000-4000-8000-000000000013'::text
  ) $$,
  $$ values ('front'::text) $$,
  'capture begins through the controlled preparation step'
);

select results_eq(
  $$ select current_step from graftvision_private.record_scan_capture_step(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid, 'front', 'complete', 2,
    'a9000000-0000-4000-8000-000000000014'::text
  ) $$,
  $$ values ('left_profile'::text) $$,
  'capture advances in deterministic angle order'
);

select throws_ok(
  $$ select * from graftvision_private.record_scan_capture_step(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid, 'right_profile', 'complete', 3,
    'a9000000-0000-4000-8000-000000000015'::text
  ) $$,
  '40001', 'INVALID_CAPTURE_TRANSITION', 'capture cannot skip a required angle'
);

select results_eq(
  $$ select current_step from graftvision_private.record_scan_capture_step(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid, 'front', 'retake', 3,
    'a9000000-0000-4000-8000-000000000016'::text
  ) $$,
  $$ values ('front'::text) $$,
  'capture retake returns the selected completed angle'
);

select is(
  (select coalesce((retake_counts ->> 'front')::integer, 0) from public.scan_capture_state where scan_session_id = 'a1000000-0000-4000-8000-000000000001'),
  1,
  'capture retake count is persisted without image data'
);

select throws_ok(
  $$ select * from graftvision_private.record_scan_capture_step(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid, 'front', 'complete', 3,
    'a9000000-0000-4000-8000-000000000017'::text
  ) $$,
  '40001', 'SCAN_CAPTURE_CONFLICT', 'stale capture revision is denied'
);

select is(
  (select completed_steps from graftvision_private.read_scan_capture_state(
    current_setting('graftvision.test_doc_session1')::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  )),
  array[]::text[],
  'capture state is read from the server for refresh resume'
);

select results_eq(
  $$
    select status
    from graftvision_private.transition_scan_session_status(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'completed',
      null,
      'a9000000-0000-4000-8000-000000000005'
    ) s
  $$,
  $$ values ('completed'::text) $$,
  'transition_scan_session_status succeeds for paired -> completed'
);

-- 6. Invalid transitions
select throws_ok(
  $$
    select * from graftvision_private.transition_scan_session_status(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'paired',
      null,
      'a9000000-0000-4000-8000-000000000006'
    )
  $$,
  '40001',
  'INVALID_LIFECYCLE_TRANSITION',
  'transition_scan_session_status rejects completed -> paired'
);

-- 7. Revocation
select * from graftvision_private.create_scan_session(
  current_setting('graftvision.test_doc_session1')::uuid,
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'c4000000-0000-4000-8000-000000000001'::uuid,
  current_setting('graftvision.test_consultation_id')::uuid,
  'token-hash-3',
  clock_timestamp() + interval '15 minutes',
  'a9000000-0000-4000-8000-000000000007'
);

select results_eq(
  $$
    select status
    from graftvision_private.transition_scan_session_status(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000003'::uuid,
      'revoked',
      'test-reason',
      'a9000000-0000-4000-8000-000000000008'
    ) s
  $$,
  $$ values ('revoked'::text) $$,
  'transition_scan_session_status succeeds for created -> revoked'
);

select is(
  (select revocation_reason from public.scan_session where id = 'a1000000-0000-4000-8000-000000000003'),
  'test-reason'::text,
  'transition_scan_session_status persists the revocation reason'
);

-- 8. RLS and Tenant Isolation

-- First test RLS rules as authenticated user
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000002","session_id":"c8000000-0000-4000-8000-000000000002","aud":"authenticated"}', true);

select throws_ok(
  $$ select * from public.scan_session where clinic_id = 'c2000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'Clinic B cannot read Clinic A scan sessions (table revoked for authenticated)'
);

-- Then test tenant isolation via backend functions (requires postgres role)
reset role;

select throws_ok(
  $$
    select * from graftvision_private.pair_scan_session(
      current_setting('graftvision.test_doc_session2')::uuid,
      'c1000000-0000-4000-8000-000000000002'::uuid,
      'a1000000-0000-4000-8000-000000000001'::uuid,
      'nonce-attack',
      'a9000000-0000-4000-8000-000000000009'
    )
  $$,
  'P0002',
  null,
  'Clinic B cannot pair a scan session belonging to Clinic A'
);

delete from public.role_permission
where role_code = 'DOCTOR' and permission_id = 'SCAN-PERM-001';

select throws_ok(
  $$
    select * from graftvision_private.create_scan_session(
      current_setting('graftvision.test_doc_session1')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a1000000-0000-4000-8000-000000000005'::uuid,
      'c4000000-0000-4000-8000-000000000001'::uuid,
      current_setting('graftvision.test_consultation_id')::uuid,
      'unauthorized-token-hash',
      clock_timestamp() + interval '15 minutes',
      'a9000000-0000-4000-8000-000000000015'
    )
  $$,
  '42501',
  'SCAN_SESSION_CREATE_DENIED',
  'create_scan_session denies a Doctor without SCAN-PERM-001'
);

select * from finish();
rollback;
