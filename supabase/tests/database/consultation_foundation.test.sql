-- CONSULT-001 consultation foundation tests. Synthetic data only.
begin;
select plan(67);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('c2000000-0000-4000-8000-000000000001','consult-a','Synthetic Consult Clinic A','active','Asia/Karachi'),
  ('c2000000-0000-4000-8000-000000000002','consult-b','Synthetic Consult Clinic B','active','Asia/Karachi'),
  ('c2000000-0000-4000-8000-000000000003','consult-c','Synthetic Not Ready Clinic','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('c1000000-0000-4000-8000-000000000001','c9000000-0000-4000-8000-000000000001','active'),
  ('c1000000-0000-4000-8000-000000000002','c9000000-0000-4000-8000-000000000002','active'),
  ('c1000000-0000-4000-8000-000000000003','c9000000-0000-4000-8000-000000000003','active'),
  ('c1000000-0000-4000-8000-000000000004','c9000000-0000-4000-8000-000000000004','active'),
  ('c1000000-0000-4000-8000-000000000005','c9000000-0000-4000-8000-000000000005','active'),
  ('c1000000-0000-4000-8000-000000000006','c9000000-0000-4000-8000-000000000006','active'),
  ('c1000000-0000-4000-8000-000000000007','c9000000-0000-4000-8000-000000000007','active'),
  ('c1000000-0000-4000-8000-000000000008','c9000000-0000-4000-8000-000000000008','active'),
  ('c1000000-0000-4000-8000-000000000009','c9000000-0000-4000-8000-000000000009','active'),
  ('c1000000-0000-4000-8000-000000000010','c9000000-0000-4000-8000-000000000010','active');
insert into public.platform_user_role (platform_user_id, role_code)
values ('c1000000-0000-4000-8000-000000000010','PLATFORM_OWNER');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','active'),
  ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','active'),
  ('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003','active'),
  ('c3000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','active'),
  ('c3000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000005','active'),
  ('c3000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000006','active'),
  ('c3000000-0000-4000-8000-000000000007','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000007','active'),
  ('c3000000-0000-4000-8000-000000000008','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000008','active'),
  ('c3000000-0000-4000-8000-000000000009','c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000009','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('c3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000002','CLINIC_ADMIN'),
  ('c3000000-0000-4000-8000-000000000003','CLINICAL_ASSISTANT'),
  ('c3000000-0000-4000-8000-000000000004','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000005','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000006','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000007','CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000007','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000008','CLINIC_ADMIN'),
  ('c3000000-0000-4000-8000-000000000009','CLINICAL_ASSISTANT');

select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values
  ('c5000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('c5000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000005','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('c5000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000006','revoked',null,null),
  ('c5000000-0000-4000-8000-000000000007','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000007','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);

select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('c2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000007',1),
  ('c2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000007',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient (
  id, clinic_id, patient_number, status, provenance_code, created_by, updated_by
) values
  ('c6000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','GV-900001','active','MANUAL_REGISTRATION','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000003'),
  ('c6000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','GV-900001','active','MANUAL_REGISTRATION','c1000000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000007'),
  ('c6000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','GV-900002','active','MANUAL_REGISTRATION','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000003');
update public.patient
set lifecycle_state='archived', archived_at=clock_timestamp(),
  archive_reason_code='administrative_cleanup', archived_by='c1000000-0000-4000-8000-000000000001'
where id='c6000000-0000-4000-8000-000000000003';
select set_config('graftvision.patient_controlled','off',true);

select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000001','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','owner-a',null
) owner_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000002','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','admin-a',null
) admin_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000003','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','assistant-a',null
) assistant_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000004','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','doctor-a',null
) doctor_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000006','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','doctor-revoked',null
) doctor_revoked_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000007','clinic','c2000000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000007',clock_timestamp()+interval '1 hour','doctor-b',null
) doctor_b_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000008','clinic','c2000000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000008',clock_timestamp()+interval '1 hour','admin-b',null
) admin_b_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000009','clinic','c2000000-0000-4000-8000-000000000003',
  'c4000000-0000-4000-8000-000000000009',clock_timestamp()+interval '1 hour','assistant-not-ready',null
) not_ready_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000010','platform',null,
  'c4000000-0000-4000-8000-000000000010',clock_timestamp()+interval '1 hour','platform-owner',null
) platform_session \gset

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue is exactly sixty');
select ok(exists(select 1 from public.permission_definition where permission_id='CONSULT-PERM-003'),'dedicated Doctor assignment permission exists');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_OWNER' and permission_id='CONSULT-PERM-003'),'Clinic Owner receives Doctor assignment permission');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='CONSULT-PERM-003'),'Clinic Administrator receives Doctor assignment permission');
select ok(not exists(select 1 from public.role_permission where role_code='DOCTOR' and permission_id='CONSULT-PERM-003'),'Doctor does not receive assignment permission');
select ok(not exists(select 1 from public.role_permission where role_code='CLINICAL_ASSISTANT' and permission_id='CONSULT-PERM-003'),'Clinical Assistant does not receive assignment permission');
select ok(not exists(select 1 from public.role_permission where role_code='RECEPTION' and permission_id='CONSULT-PERM-003'),'Reception does not receive assignment permission');

select * from graftvision_private.create_consultation(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',
  'c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001'
) \gset consultation_a_
select ok(:'consultation_a_id'::uuid is not null,'same-clinic consultation creation succeeds');
select is(:'consultation_a_status'::text,'draft','consultation starts in draft');
select is(:'consultation_a_revision'::integer,1,'consultation starts at revision one');
select is((select count(*) from public.consultation_status_history where consultation_id=:'consultation_a_id'),1::bigint,'creation appends immutable status history');
select is((select count(*) from public.audit_event where action='consultation.create' and resource_id=:'consultation_a_id'),1::bigint,'creation writes one audit event');
select * from graftvision_private.create_consultation(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',
  'c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001'
) \gset consultation_retry_
select is(:'consultation_retry_id'::uuid,:'consultation_a_id'::uuid,'idempotent creation returns original consultation');
select is((select count(*) from public.consultation where patient_id='c6000000-0000-4000-8000-000000000001'),1::bigint,'idempotent creation adds no duplicate');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000001'),'P0002','PATIENT_NOT_ELIGIBLE','same key with an archived payload remains ineligible');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000002'),'P0002','PATIENT_NOT_ELIGIBLE','cross-clinic patient is denied');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000003'),'P0002','PATIENT_NOT_ELIGIBLE','archived patient is non-actionable');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'not_ready_session','c1000000-0000-4000-8000-000000000009','c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','not-ready clinic is denied');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'platform_session','c1000000-0000-4000-8000-000000000010','c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','platform scope is denied');
select throws_ok(format($sql$select * from graftvision_private.create_consultation(%L::uuid,%L::uuid,%L::uuid,%L::uuid)$sql$,:'doctor_revoked_session','c1000000-0000-4000-8000-000000000006','c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000006'),'42501','AUTH_PERMISSION_DENIED','revoked Doctor authority is denied');
select * from graftvision_private.create_consultation(
  :'doctor_a_session','c1000000-0000-4000-8000-000000000004',
  'c6000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000007'
) \gset doctor_consultation_
select ok(:'doctor_consultation_id'::uuid is not null,'verified Doctor may create consultation');
select is((select count(*) from graftvision_private.read_consultation(:'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id')),1::bigint,'same-clinic consultation reading succeeds');
select is((select count(*) from graftvision_private.read_consultation(:'doctor_b_session','c1000000-0000-4000-8000-000000000007',:'consultation_a_id')),0::bigint,'Clinic B cannot read Clinic A consultation');
select is((select count(*) from graftvision_private.list_consultations(:'assistant_a_session','c1000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000001')),2::bigint,'same-clinic consultation listing is patient scoped');

select * from graftvision_private.assign_consultation_doctor(
  :'owner_a_session','c1000000-0000-4000-8000-000000000001',:'consultation_a_id',
  'c1000000-0000-4000-8000-000000000004',1,'INITIAL_ASSIGNMENT',
  'ca000000-0000-4000-8000-000000000008'
) \gset assignment_
select is(:'assignment_doctor_platform_user_id'::uuid,'c1000000-0000-4000-8000-000000000004'::uuid,'eligible same-clinic Doctor assignment succeeds');
select is(:'assignment_revision'::integer,2,'Doctor assignment increments consultation revision exactly once');
select is((select count(*) from public.consultation_assignment_history where consultation_id=:'consultation_a_id'),1::bigint,'assignment appends immutable Doctor history');
select is((select count(*) from public.audit_event where action='consultation.doctor_assign' and resource_id=:'consultation_a_id'),1::bigint,'assignment writes redacted audit evidence');
select * from graftvision_private.assign_consultation_doctor(
  :'owner_a_session','c1000000-0000-4000-8000-000000000001',:'consultation_a_id',
  'c1000000-0000-4000-8000-000000000004',1,'INITIAL_ASSIGNMENT',
  'ca000000-0000-4000-8000-000000000008'
) \gset assignment_retry_
select is(:'assignment_retry_revision'::integer,2,'idempotent assignment returns original revision');
select throws_ok(format($sql$select * from graftvision_private.assign_consultation_doctor(%L::uuid,%L::uuid,%L::uuid,%L::uuid,1,'INITIAL_ASSIGNMENT',%L::uuid)$sql$,:'owner_a_session','c1000000-0000-4000-8000-000000000001',:'consultation_a_id','c1000000-0000-4000-8000-000000000005','ca000000-0000-4000-8000-000000000008'),'22023','IDEMPOTENCY_KEY_REUSED','assignment key reuse with changed Doctor is denied');
select throws_ok(format($sql$select * from graftvision_private.assign_consultation_doctor(%L::uuid,%L::uuid,%L::uuid,%L::uuid,2,'CASELOAD_REBALANCE',%L::uuid)$sql$,:'owner_a_session','c1000000-0000-4000-8000-000000000001',:'consultation_a_id','c1000000-0000-4000-8000-000000000007','ca000000-0000-4000-8000-000000000009'),'42501','DOCTOR_AUTHORITY_DENIED','cross-clinic Doctor assignment is denied');
select throws_ok(format($sql$select * from graftvision_private.assign_consultation_doctor(%L::uuid,%L::uuid,%L::uuid,%L::uuid,2,'DOCTOR_UNAVAILABLE',%L::uuid)$sql$,:'owner_a_session','c1000000-0000-4000-8000-000000000001',:'consultation_a_id','c1000000-0000-4000-8000-000000000006','ca000000-0000-4000-8000-000000000010'),'42501','DOCTOR_AUTHORITY_DENIED','revoked Doctor assignment is denied');
select * from graftvision_private.assign_consultation_doctor(
  :'admin_a_session','c1000000-0000-4000-8000-000000000002',:'consultation_a_id',
  'c1000000-0000-4000-8000-000000000005',2,'CASELOAD_REBALANCE',
  'ca000000-0000-4000-8000-000000000011'
) \gset reassignment_
select is(:'reassignment_doctor_platform_user_id'::uuid,'c1000000-0000-4000-8000-000000000005'::uuid,'Clinic Administrator may reassign eligible Doctor');
select is((select count(*) from public.consultation_assignment_history where consultation_id=:'consultation_a_id'),2::bigint,'reassignment preserves previous and new Doctor history');
select is((select count(*) from public.audit_event where action='consultation.doctor_reassign' and resource_id=:'consultation_a_id'),1::bigint,'reassignment writes redacted audit evidence');
select throws_ok(format($sql$select * from graftvision_private.assign_consultation_doctor(%L::uuid,%L::uuid,%L::uuid,%L::uuid,2,'DOCTOR_UNAVAILABLE',%L::uuid)$sql$,:'admin_a_session','c1000000-0000-4000-8000-000000000002',:'consultation_a_id','c1000000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000012'),'40001','CONSULTATION_REVISION_CONFLICT','stale concurrent assignment is denied');
select * from graftvision_private.assign_consultation_doctor_with_concurrency(
  :'admin_a_session','c1000000-0000-4000-8000-000000000002',:'consultation_a_id',
  'c1000000-0000-4000-8000-000000000004',2,'DOCTOR_UNAVAILABLE',
  'ca000000-0000-4000-8000-000000000019'
) \gset assignment_conflict_
select is(:'assignment_conflict_outcome_code'::text,'stale_revision','concurrent Doctor reassignment returns structured stale revision');
select is(:'assignment_conflict_revision'::integer,3,'Doctor assignment conflict returns current consultation revision');
select is((select count(*) from public.consultation_assignment_history where consultation_id=:'consultation_a_id'),2::bigint,'stale Doctor assignment adds no history');
select is((select count(*) from public.consultation_operation_idempotency where idempotency_key='ca000000-0000-4000-8000-000000000019'),0::bigint,'stale Doctor assignment adds no idempotency record');
select ok(exists(
  select 1 from public.audit_event
  where action='consultation.concurrency_conflict' and resource_id=:'consultation_a_id'
    and metadata->>'operation_code'='doctor_assignment'
    and metadata->>'outcome_code'='stale_revision'
    and not (metadata::text ~* '(patient|doctor_platform|token|cookie|name|email|phone|request)')
),'Doctor assignment conflict writes redacted audit evidence');

select throws_ok(format($sql$update public.consultation set status='completed' where id=%L::uuid$sql$,:'consultation_a_id'),'42501','CONSULTATION_CONTROLLED_MUTATION_REQUIRED','direct consultation mutation is denied');
select throws_ok(format($sql$update public.consultation_status_history set reason_code='CONSULTATION_CANCELLED' where consultation_id=%L::uuid$sql$,:'consultation_a_id'),'42501','CONSULTATION_HISTORY_IMMUTABLE','consultation status history is immutable');
select throws_ok(format($sql$delete from public.consultation_assignment_history where consultation_id=%L::uuid$sql$,:'consultation_a_id'),'42501','CONSULTATION_HISTORY_IMMUTABLE','consultation assignment history is immutable');

select * from graftvision_private.transition_consultation_status(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id',
  3,'in_progress','PREPARATION_STARTED','ca000000-0000-4000-8000-000000000013'
) \gset transitioned_
select is(:'transitioned_status'::text,'in_progress','controlled draft preparation transition succeeds');
select is((select count(*) from public.consultation_status_history where consultation_id=:'consultation_a_id'),2::bigint,'status transition appends history');
select is((select count(*) from public.audit_event where action='consultation.status_change' and resource_id=:'consultation_a_id'),1::bigint,'status transition is audited');
select * from graftvision_private.transition_consultation_status(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id',
  3,'in_progress','PREPARATION_STARTED','ca000000-0000-4000-8000-000000000013'
) \gset transitioned_retry_
select is(:'transitioned_retry_revision'::integer,4,'idempotent status replay returns original result');
select * from graftvision_private.transition_consultation_status_with_concurrency(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id',
  4,'cancelled','CONSULTATION_CANCELLED','ca000000-0000-4000-8000-000000000016'
) \gset concurrency_success_
select is(:'concurrency_success_outcome_code'::text,'success','current revision status mutation succeeds');
select is(:'concurrency_success_revision'::integer,5,'successful concurrent mutation increments revision exactly once');
select * from graftvision_private.transition_consultation_status_with_concurrency(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id',
  4,'cancelled','CONSULTATION_CANCELLED','ca000000-0000-4000-8000-000000000017'
) \gset concurrency_conflict_
select is(:'concurrency_conflict_outcome_code'::text,'stale_revision','second editor receives structured stale revision');
select is(:'concurrency_conflict_revision'::integer,5,'conflict projection returns current revision');
select is(:'concurrency_conflict_status'::text,'cancelled','conflict projection returns current status');
select is((select count(*) from public.consultation_status_history where consultation_id=:'consultation_a_id'),3::bigint,'stale mutation adds no history');
select is((select count(*) from public.consultation_operation_idempotency where idempotency_key='ca000000-0000-4000-8000-000000000017'),0::bigint,'stale mutation adds no idempotency record');
select is((select count(*) from public.audit_event where action='consultation.concurrency_conflict' and resource_id=:'consultation_a_id' and metadata->>'operation_code'='status_transition'),1::bigint,'authorised stale status mutation writes one conflict audit event');
select ok(exists(
  select 1 from public.audit_event
  where action='consultation.concurrency_conflict' and resource_id=:'consultation_a_id'
    and metadata = jsonb_build_object(
      'operation_code','status_transition','expected_revision',4,
      'current_revision',5,'outcome_code','stale_revision',
      'changed_fields',jsonb_build_array('status','consultation_revision')
    )
),'conflict audit metadata is bounded and redacted');
select * from graftvision_private.transition_consultation_status_with_concurrency(
  :'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id',
  3,'in_progress','PREPARATION_STARTED','ca000000-0000-4000-8000-000000000013'
) \gset historical_replay_
select is(:'historical_replay_revision'::integer,4,'same-payload replay returns the original revision after a later mutation');
select is(:'historical_replay_status'::text,'in_progress','same-payload replay returns the original status after a later mutation');
select throws_ok(format(
  $sql$select * from graftvision_private.transition_consultation_status_with_concurrency(
    %L::uuid,%L::uuid,%L::uuid,4,'cancelled','CONSULTATION_CANCELLED',%L::uuid
  )$sql$,
  :'doctor_b_session','c1000000-0000-4000-8000-000000000007',
  :'consultation_a_id','ca000000-0000-4000-8000-000000000018'
),'P0002','CONSULTATION_NOT_FOUND','cross-tenant request remains a pre-access denial without a conflict projection');
select throws_ok(format($sql$select * from graftvision_private.transition_consultation_status(%L::uuid,%L::uuid,%L::uuid,4,'completed','PREPARATION_RESUMED',%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id','ca000000-0000-4000-8000-000000000014'),'22023','INVALID_CONSULTATION_STATUS_REQUEST','completion remains unavailable until its later clinical gate');

update public.application_session set locked_at=clock_timestamp(), lock_reason_code='MANUAL'
where id=:'assistant_a_session';
select throws_ok(format($sql$select * from graftvision_private.read_consultation(%L::uuid,%L::uuid,%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
update public.application_session set locked_at=null, lock_reason_code=null,
  clinic_authorization_version=0 where id=:'assistant_a_session';
select throws_ok(format($sql$select * from graftvision_private.read_consultation(%L::uuid,%L::uuid,%L::uuid)$sql$,:'assistant_a_session','c1000000-0000-4000-8000-000000000003',:'consultation_a_id'),'42501','AUTH_PERMISSION_DENIED','stale session is denied');
update public.clinic_membership set membership_status='suspended'
where id='c3000000-0000-4000-8000-000000000002';
select throws_ok(format($sql$select * from graftvision_private.assign_consultation_doctor(%L::uuid,%L::uuid,%L::uuid,%L::uuid,4,'DOCTOR_UNAVAILABLE',%L::uuid)$sql$,:'admin_a_session','c1000000-0000-4000-8000-000000000002',:'consultation_a_id','c1000000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000015'),'42501','AUTH_PERMISSION_DENIED','inactive membership is denied');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('consultation','consultation_assignment','consultation_status_history','consultation_assignment_history','consultation_operation_idempotency') and c.relrowsecurity and c.relforcerowsecurity),5::bigint,'all consultation tables enable and force RLS');
select ok(not exists(select 1 from public.audit_event where resource_id=:'consultation_a_id' and metadata::text ~* '(patient|doctor_platform|token|cookie|name|email|phone|request)'), 'consultation audit metadata excludes sensitive data');

select * from finish();
rollback;
