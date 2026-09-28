-- PATIENT-002 registration and deterministic duplicate tests. Synthetic data only.
begin;
select plan(40);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('c2000000-0000-4000-8000-000000000001','register-a','Synthetic Register Clinic A','active','Asia/Karachi'),
  ('c2000000-0000-4000-8000-000000000002','register-b','Synthetic Register Clinic B','active','Asia/Karachi'),
  ('c2000000-0000-4000-8000-000000000003','register-c','Synthetic Register Clinic C','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('c1000000-0000-4000-8000-000000000001','c9000000-0000-4000-8000-000000000001','active'),
  ('c1000000-0000-4000-8000-000000000002','c9000000-0000-4000-8000-000000000002','active'),
  ('c1000000-0000-4000-8000-000000000003','c9000000-0000-4000-8000-000000000003','active'),
  ('c1000000-0000-4000-8000-000000000004','c9000000-0000-4000-8000-000000000004','active'),
  ('c1000000-0000-4000-8000-000000000005','c9000000-0000-4000-8000-000000000005','active'),
  ('c1000000-0000-4000-8000-000000000006','c9000000-0000-4000-8000-000000000006','active');
insert into public.platform_user_role (platform_user_id, role_code) values
  ('c1000000-0000-4000-8000-000000000006','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','active'),
  ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','active'),
  ('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003','active'),
  ('c3000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','active'),
  ('c3000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000005','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('c3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000002','RECEPTION'),
  ('c3000000-0000-4000-8000-000000000003','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000004','DOCTOR'),
  ('c3000000-0000-4000-8000-000000000005','RECEPTION'),
  ('c3000000-0000-4000-8000-000000000005','CLINIC_OWNER'),
  ('c3000000-0000-4000-8000-000000000005','DOCTOR');
select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values
  ('c5000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('c5000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000005','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);
select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('c2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000001',1),
  ('c2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','c1000000-0000-4000-8000-000000000005',1),
  ('c2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','c1000000-0000-4000-8000-000000000005',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000002','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','register-a',null
) reception_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000003','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','doctor-a',null
) doctor_a_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000004','clinic','c2000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','doctor-unverified',null
) doctor_unverified_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000005','clinic','c2000000-0000-4000-8000-000000000002',
  'c4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','register-b',null
) reception_b_session \gset
select graftvision_private.create_application_session(
  'c1000000-0000-4000-8000-000000000006','platform',null,
  'c4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select * from graftvision_private.register_patient(
  :'reception_a_session','c1000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000001','  Example   Person  ','1990-02-03',
  '+92 (300) 123-4567',' EXAMPLE.PERSON@EXAMPLE.TEST ','REGISTRATION_FORM',null
) \gset first_
select is(:'first_outcome'::text,'created'::text,'valid registration succeeds');
select is(:'first_patient_number'::text,'GV-000001'::text,'patient number remains server generated');
select is((select full_name from public.patient_registration where patient_id=:'first_id'),'Example Person','display name whitespace is controlled');
select is((select normalised_name from public.patient_registration where patient_id=:'first_id'),'example person','normalised name is server derived');
select is((select phone from public.patient_registration where patient_id=:'first_id'),'+923001234567','phone is normalised to E.164');
select is((select email from public.patient_registration where patient_id=:'first_id'),'example.person@example.test','email is trimmed and lowercased');
select is((select date_of_birth from public.patient_registration where patient_id=:'first_id'),date '1990-02-03','date of birth is stored as a date');
select is((select count(*) from public.patient_registration_history where patient_id=:'first_id'),1::bigint,'registration appends immutable history');
select is((select count(*) from public.audit_event where action='patient.registration_create' and resource_id=:'first_id'),1::bigint,'registration creation is audited');

select * from graftvision_private.register_patient(
  :'reception_a_session','c1000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000001','Example Person','1990-02-03',
  '+923001234567','example.person@example.test','REGISTRATION_FORM',null
) \gset retry_
select is(:'retry_id'::uuid,:'first_id'::uuid,'idempotent retry returns original registration');
select is((select count(*) from public.patient_registration where clinic_id='c2000000-0000-4000-8000-000000000001'),1::bigint,'idempotent retry creates no duplicate registration');
select is((select count(*) from public.audit_event where action='patient.registration_create' and resource_id=:'first_id'),1::bigint,'idempotent retry creates no duplicate audit');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Changed Person','1990-02-03','+923001234567',null,'REGISTRATION_FORM',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000001'),'22023','IDEMPOTENCY_KEY_REUSED','same key with changed payload is rejected');

select * from graftvision_private.register_patient(
  :'reception_b_session','c1000000-0000-4000-8000-000000000005',
  'ca000000-0000-4000-8000-000000000002','Example Person','1990-02-03',
  '+923001234567','example.person@example.test','REGISTRATION_FORM',null
) \gset cross_
select is(:'cross_outcome'::text,'created'::text,'same identity-like values in another clinic do not warn');
select is(:'cross_patient_number'::text,'GV-000001'::text,'cross-clinic numbering remains independent');

select * from graftvision_private.register_patient(
  :'reception_a_session','c1000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000003','Another Display','1985-08-09',
  '+923001234567','another@example.test','REGISTRATION_FORM',null
) \gset warning_
select is(:'warning_outcome'::text,'duplicate_warning'::text,'same-clinic phone produces duplicate warning');
select is(jsonb_array_length(:'warning_duplicates'::jsonb),1,'duplicate warning returns one same-clinic match');
select ok((:'warning_duplicates'::jsonb->0) ? 'maskedName','duplicate projection includes masked name');
select ok(not (:'warning_duplicates'::jsonb->0)::text ~* 'Example Person|\+923001234567|example.person@example.test','duplicate projection excludes full identity and contact values');
select is((select count(*) from public.patient where clinic_id='c2000000-0000-4000-8000-000000000001'),1::bigint,'warning without override creates no patient');
select is((select count(*) from public.patient_duplicate_decision_history where decision_code='warning'),1::bigint,'duplicate warning writes one immutable decision');
select is((select count(*) from public.audit_event where action='patient.duplicate_warning'),1::bigint,'duplicate warning is audited once');

select * from graftvision_private.register_patient(
  :'reception_a_session','c1000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000003','Another Display','1985-08-09',
  '+923001234567','another@example.test','REGISTRATION_FORM','CONFIRMED_DISTINCT_PERSON'
) \gset override_
select is(:'override_outcome'::text,'created'::text,'authorised controlled duplicate override succeeds');
select is((select count(*) from public.patient_duplicate_decision_history where decision_code='override' and patient_id=:'override_id'),1::bigint,'override appends one immutable decision');
select is((select count(*) from public.audit_event where action='patient.duplicate_override' and resource_id=:'override_id'),1::bigint,'override is audited once');
select is((select count(*) from public.patient_registration_history where patient_id=:'override_id'),1::bigint,'override registration history is atomic');
select * from graftvision_private.register_patient(
  :'reception_a_session','c1000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000003','Another Display','1985-08-09',
  '+923001234567','another@example.test','REGISTRATION_FORM','CONFIRMED_DISTINCT_PERSON'
) \gset override_retry_
select is(:'override_retry_id'::uuid,:'override_id'::uuid,'override retry returns original patient');
select is((select count(*) from public.patient_duplicate_decision_history where decision_code='override' and patient_id=:'override_id'),1::bigint,'override retry creates no duplicate history');
select is((select count(*) from public.audit_event where action='patient.duplicate_override' and resource_id=:'override_id'),1::bigint,'override retry creates no duplicate audit');

select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Bad Phone','1990-01-01','03001234567',null,'REGISTRATION_FORM',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000004'),'22023','INVALID_PATIENT_REGISTRATION','unsupported phone format is rejected');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Bad Email','1990-01-01','+923001111111','invalid', 'REGISTRATION_FORM',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000005'),'22023','INVALID_PATIENT_REGISTRATION','malformed email is rejected');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Future Birth','2099-01-01','+923001111112',null,'REGISTRATION_FORM',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000006'),'22023','INVALID_PATIENT_REGISTRATION','future date of birth is rejected');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Invalid Provenance','1990-01-01','+923001111113',null,'IMPORTED',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000007'),'22023','INVALID_PATIENT_REGISTRATION','invalid provenance is rejected');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Unverified Doctor','1990-01-01','+923001111114',null,'REGISTRATION_FORM',null)$sql$,:'doctor_unverified_session','c1000000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000008'),'42501','AUTH_PERMISSION_DENIED','unverified Doctor is denied');
select lives_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Verified Doctor','1990-01-01','+923001111115',null,'REGISTRATION_FORM',null)$sql$,:'doctor_a_session','c1000000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000009'),'verified Doctor may register patient');
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Support User','1990-01-01','+923001111116',null,'REGISTRATION_FORM',null)$sql$,:'support_session','c1000000-0000-4000-8000-000000000006','ca000000-0000-4000-8000-000000000010'),'42501','AUTH_PERMISSION_DENIED','Support ordinary access is denied');
select set_config('graftvision.session_controlled','on',true);
update public.application_session set locked_at=clock_timestamp(), lock_reason_code='MANUAL' where id=:'reception_a_session';
select set_config('graftvision.session_controlled','off',true);
select throws_ok(format($sql$select * from graftvision_private.register_patient(%L::uuid,%L::uuid,%L::uuid,'Locked User','1990-01-01','+923001111117',null,'REGISTRATION_FORM',null)$sql$,:'reception_a_session','c1000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000011'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
select throws_ok($$insert into public.patient_registration (patient_id,clinic_id,full_name,normalised_name,date_of_birth,phone,revision,provenance_code,created_by,updated_by) values ('ca999999-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Direct','direct','1990-01-01','+923001111118',1,'REGISTRATION_FORM','c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002')$$,'55000','PATIENT_CONTROLLED_MUTATION_REQUIRED','direct registration mutation is denied');
select throws_ok($$delete from public.patient_duplicate_decision_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','duplicate decision history is immutable');
select ok(not exists(select 1 from public.audit_event where action like 'patient.%' and metadata::text ~* '(Example Person|923001234567|example.person|date_of_birth|full_name|phone|email|request_body|token|cookie)'),'patient registration audit excludes sensitive data');

select * from finish();
rollback;
