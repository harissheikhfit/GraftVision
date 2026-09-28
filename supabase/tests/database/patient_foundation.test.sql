-- PATIENT-001 tenant-scoped patient root tests. Synthetic data only.
begin;
select plan(48);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('b2000000-0000-4000-8000-000000000001','patient-a','Synthetic Clinic A','active','Asia/Karachi'),
  ('b2000000-0000-4000-8000-000000000002','patient-b','Synthetic Clinic B','active','Asia/Karachi'),
  ('b2000000-0000-4000-8000-000000000003','patient-c','Synthetic Clinic C','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('b1000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','active'),
  ('b1000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000002','active'),
  ('b1000000-0000-4000-8000-000000000003','b9000000-0000-4000-8000-000000000003','active'),
  ('b1000000-0000-4000-8000-000000000004','b9000000-0000-4000-8000-000000000004','active'),
  ('b1000000-0000-4000-8000-000000000005','b9000000-0000-4000-8000-000000000005','active'),
  ('b1000000-0000-4000-8000-000000000006','b9000000-0000-4000-8000-000000000006','active'),
  ('b1000000-0000-4000-8000-000000000007','b9000000-0000-4000-8000-000000000007','active'),
  ('b1000000-0000-4000-8000-000000000008','b9000000-0000-4000-8000-000000000008','active'),
  ('b1000000-0000-4000-8000-000000000009','b9000000-0000-4000-8000-000000000009','active'),
  ('b1000000-0000-4000-8000-000000000010','b9000000-0000-4000-8000-000000000010','active');
insert into public.platform_user_role (platform_user_id, role_code) values
  ('b1000000-0000-4000-8000-000000000010','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','active'),
  ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','active'),
  ('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','active'),
  ('b3000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','active'),
  ('b3000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000005','active'),
  ('b3000000-0000-4000-8000-000000000006','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000006','active'),
  ('b3000000-0000-4000-8000-000000000007','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000007','active'),
  ('b3000000-0000-4000-8000-000000000008','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000008','active'),
  ('b3000000-0000-4000-8000-000000000009','b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000009','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('b3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('b3000000-0000-4000-8000-000000000002','DOCTOR'),
  ('b3000000-0000-4000-8000-000000000003','RECEPTION'),
  ('b3000000-0000-4000-8000-000000000004','CLINICAL_ASSISTANT'),
  ('b3000000-0000-4000-8000-000000000005','PRESENTATION'),
  ('b3000000-0000-4000-8000-000000000006','DOCTOR'),
  ('b3000000-0000-4000-8000-000000000007','CLINIC_OWNER'),
  ('b3000000-0000-4000-8000-000000000007','DOCTOR'),
  ('b3000000-0000-4000-8000-000000000008','RECEPTION'),
  ('b3000000-0000-4000-8000-000000000009','RECEPTION');

select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values
  ('b5000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('b5000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000007','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);

select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('b2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','b1000000-0000-4000-8000-000000000001',1),
  ('b2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','b1000000-0000-4000-8000-000000000001',1),
  ('b2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','b1000000-0000-4000-8000-000000000007',1),
  ('b2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','b1000000-0000-4000-8000-000000000007',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000003','clinic','b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','reception-a',null
) reception_a_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000004','clinic','b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','assistant-a',null
) assistant_a_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000002','clinic','b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','doctor-a',null
) doctor_a_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000006','clinic','b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','doctor-unverified',null
) doctor_unverified_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000005','clinic','b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','presentation',null
) presentation_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000008','clinic','b2000000-0000-4000-8000-000000000002',
  'b4000000-0000-4000-8000-000000000008',clock_timestamp()+interval '1 hour','reception-b',null
) reception_b_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000009','clinic','b2000000-0000-4000-8000-000000000003',
  'b4000000-0000-4000-8000-000000000009',clock_timestamp()+interval '1 hour','reception-c',null
) reception_c_session \gset
select graftvision_private.create_application_session(
  'b1000000-0000-4000-8000-000000000010','platform',null,
  'b4000000-0000-4000-8000-000000000010',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue remains sixty');
select ok(exists(select 1 from public.role_permission where role_code='RECEPTION' and permission_id='PATIENT-PERM-001'),'Reception has exact patient permission');
select ok(exists(select 1 from public.role_permission where role_code='DOCTOR' and permission_id='PATIENT-PERM-001'),'Doctor has exact patient permission');

select * from graftvision_private.create_patient_root(
  :'reception_a_session','b1000000-0000-4000-8000-000000000003',
  'ba000000-0000-4000-8000-000000000001','active','MANUAL_REGISTRATION'
) \gset patient_a_
select is(:'patient_a_patient_number'::text,'GV-000001'::text,'first patient number is generated server-side');
select is(:'patient_a_status'::text,'active'::text,'successful creation returns active status');
select is(:'patient_a_revision'::integer,1,'successful creation returns revision one');
select ok(:'patient_a_id'::uuid is not null,'successful creation returns opaque patient id');
select is((select count(*) from public.patient where clinic_id='b2000000-0000-4000-8000-000000000001'),1::bigint,'successful creation writes one patient');
select is((select count(*) from public.patient_status_history where patient_id=:'patient_a_id'),1::bigint,'creation appends one history row');
select is((select count(*) from public.audit_event where action='patient.create' and resource_id=:'patient_a_id'),1::bigint,'creation writes one audit event');

select * from graftvision_private.create_patient_root(
  :'reception_a_session','b1000000-0000-4000-8000-000000000003',
  'ba000000-0000-4000-8000-000000000001','active','MANUAL_REGISTRATION'
) \gset patient_a_retry_
select is(:'patient_a_retry_id'::uuid,:'patient_a_id'::uuid,'idempotent retry returns original patient');
select is((select count(*) from public.patient where clinic_id='b2000000-0000-4000-8000-000000000001'),1::bigint,'idempotent retry creates no duplicate patient');
select is((select count(*) from public.patient_status_history where patient_id=:'patient_a_id'),1::bigint,'idempotent retry creates no duplicate history');
select is((select count(*) from public.audit_event where action='patient.create' and resource_id=:'patient_a_id'),1::bigint,'idempotent retry creates no duplicate audit');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'inactive','MANUAL_REGISTRATION')$sql$,:'reception_a_session','b1000000-0000-4000-8000-000000000003','ba000000-0000-4000-8000-000000000001'),'22023','IDEMPOTENCY_KEY_REUSED','same key with changed payload is rejected');

select * from graftvision_private.create_patient_root(
  :'reception_a_session','b1000000-0000-4000-8000-000000000003',
  'ba000000-0000-4000-8000-000000000002','inactive','MANUAL_REGISTRATION'
) \gset patient_a_second_
select is(:'patient_a_second_patient_number'::text,'GV-000002'::text,'same-clinic sequence remains unique');
select * from graftvision_private.create_patient_root(
  :'reception_b_session','b1000000-0000-4000-8000-000000000008',
  'ba000000-0000-4000-8000-000000000003','active','MANUAL_REGISTRATION'
) \gset patient_b_
select is(:'patient_b_patient_number'::text,'GV-000001'::text,'same patient number may exist in another clinic');
select is((select count(*) from public.patient where patient_number='GV-000001'),2::bigint,'patient-number uniqueness is clinic scoped');
select is((select count(*) from graftvision_private.read_patient_root(:'reception_a_session','b1000000-0000-4000-8000-000000000003',:'patient_b_id')),0::bigint,'Clinic A cannot read Clinic B patient root');
select is((select count(*) from graftvision_private.read_patient_root(:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_a_id')),0::bigint,'Clinic B cannot read Clinic A patient root');

select * from graftvision_private.create_patient_root(
  :'assistant_a_session','b1000000-0000-4000-8000-000000000004',
  'ba000000-0000-4000-8000-000000000004','active','MANUAL_REGISTRATION'
) \gset assistant_patient_
select ok(:'assistant_patient_id'::uuid is not null,'Clinical Assistant may create patient root');
select * from graftvision_private.create_patient_root(
  :'doctor_a_session','b1000000-0000-4000-8000-000000000002',
  'ba000000-0000-4000-8000-000000000005','active','MANUAL_REGISTRATION'
) \gset doctor_patient_
select ok(:'doctor_patient_id'::uuid is not null,'verified Doctor may create patient root');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'active','MANUAL_REGISTRATION')$sql$,:'doctor_unverified_session','b1000000-0000-4000-8000-000000000006','ba000000-0000-4000-8000-000000000006'),'42501','AUTH_PERMISSION_DENIED','unverified Doctor is denied');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'active','MANUAL_REGISTRATION')$sql$,:'presentation_session','b1000000-0000-4000-8000-000000000005','ba000000-0000-4000-8000-000000000007'),'42501','AUTH_PERMISSION_DENIED','Presentation role is denied');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'active','MANUAL_REGISTRATION')$sql$,:'support_session','b1000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000008'),'42501','AUTH_PERMISSION_DENIED','Support Engineer is denied');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'active','MANUAL_REGISTRATION')$sql$,:'reception_c_session','b1000000-0000-4000-8000-000000000009','ba000000-0000-4000-8000-000000000009'),'42501','AUTH_PERMISSION_DENIED','not-ready clinic is denied');

select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'pending','MANUAL_REGISTRATION')$sql$,:'reception_a_session','b1000000-0000-4000-8000-000000000003','ba000000-0000-4000-8000-000000000010'),'22023','INVALID_PATIENT_CREATE_REQUEST','invalid status is denied');
select throws_ok(format($sql$select * from graftvision_private.create_patient_root(%L::uuid,%L::uuid,%L::uuid,'active','IMPORTED')$sql$,:'reception_a_session','b1000000-0000-4000-8000-000000000003','ba000000-0000-4000-8000-000000000011'),'22023','INVALID_PATIENT_CREATE_REQUEST','invalid provenance is denied');
select is((select count(*) from public.patient where clinic_id='b2000000-0000-4000-8000-000000000001'),4::bigint,'failed requests roll back all patient writes');
select throws_ok(format($sql$select graftvision_private.change_patient_status(%L::uuid,%L::uuid,%L::uuid,1,'archived')$sql$,:'reception_a_session','b1000000-0000-4000-8000-000000000003',:'patient_a_id'),'22023','INVALID_PATIENT_STATUS_REQUEST','deferred status is denied');
select is(graftvision_private.change_patient_status(:'reception_a_session','b1000000-0000-4000-8000-000000000003',:'patient_a_id',1,'inactive'),'updated','controlled status change succeeds');
select is((select revision from public.patient where id=:'patient_a_id'),2,'status change increments revision once');
select is((select count(*) from public.patient_status_history where patient_id=:'patient_a_id'),2::bigint,'status change appends immutable history');
select is((select count(*) from public.audit_event where action='patient.status_change' and resource_id=:'patient_a_id'),1::bigint,'status change is audited');
select is(graftvision_private.change_patient_status(:'reception_a_session','b1000000-0000-4000-8000-000000000003',:'patient_a_id',1,'active'),'conflict','stale revision conflicts safely');

update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'reception_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
update public.application_session set locked_at=null,lock_reason_code=null,revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ONE' where id=:'reception_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','revoked session is denied');
update public.application_session set revoked_at=null,revoke_reason_code=null,absolute_expires_at=clock_timestamp()-interval '1 second' where id=:'reception_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','expired session is denied');
update public.application_session set absolute_expires_at=clock_timestamp()+interval '1 hour' where id=:'reception_b_session';
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='suspended' where id='b2000000-0000-4000-8000-000000000002';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','suspended clinic is denied');
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='inactive' where id='b2000000-0000-4000-8000-000000000002';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','inactive clinic is denied');
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='active' where id='b2000000-0000-4000-8000-000000000002';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
update public.application_session set clinic_authorization_version=0 where id=:'reception_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_patient_root(%L::uuid,%L::uuid,%L::uuid)$sql$,:'reception_b_session','b1000000-0000-4000-8000-000000000008',:'patient_b_id'),'42501','AUTH_PERMISSION_DENIED','stale session is denied');

select throws_ok($$insert into public.patient (clinic_id,patient_number,status,provenance_code,created_by,updated_by) values ('b2000000-0000-4000-8000-000000000001','GV-999999','active','MANUAL_REGISTRATION','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003')$$,'55000','PATIENT_CONTROLLED_MUTATION_REQUIRED','direct patient insert is denied');
select throws_ok(format($sql$update public.patient set patient_number='GV-999999' where id=%L::uuid$sql$,:'patient_a_id'),'55000','PATIENT_CONTROLLED_MUTATION_REQUIRED','patient number is immutable through direct writes');
select throws_ok($$delete from public.patient_status_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','patient history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.patient'::regclass),'patient table enables and forces RLS');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='patient' and column_name in ('name','phone','email','cnic','address','date_of_birth','gender','diagnosis','medical_history','notes','consent')),'patient root has no identity contact or clinical fields');
select ok(not exists(select 1 from public.audit_event where action like 'patient.%' and (metadata::text ~* '(name|phone|email|clinical|request|token|cookie|note)' or metadata <> '{}'::jsonb and action='patient.create')),'patient audit metadata excludes sensitive data');

select * from finish();

rollback;
