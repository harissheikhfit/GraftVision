-- PATIENT-006 reversible archive/restore tests. Synthetic data only.
begin;
select plan(22);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('f2000000-0000-4000-8000-000000000001','lifecycle-a','Synthetic Lifecycle A','active','Asia/Karachi'),
  ('f2000000-0000-4000-8000-000000000002','lifecycle-b','Synthetic Lifecycle B','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('f1000000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000001','active'),
  ('f1000000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000002','active'),
  ('f1000000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000003','active'),
  ('f1000000-0000-4000-8000-000000000004','f9000000-0000-4000-8000-000000000004','active');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','active'),
  ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','active'),
  ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','active'),
  ('f3000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000004','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('f3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('f3000000-0000-4000-8000-000000000002','RECEPTION'),
  ('f3000000-0000-4000-8000-000000000002','DOCTOR'),
  ('f3000000-0000-4000-8000-000000000003','CLINIC_OWNER'),
  ('f3000000-0000-4000-8000-000000000004','DOCTOR');
select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values
  ('f5000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('f5000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000004','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);
select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('f2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','f1000000-0000-4000-8000-000000000001',1),
  ('f2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','f1000000-0000-4000-8000-000000000001',1),
  ('f2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','f1000000-0000-4000-8000-000000000003',1),
  ('f2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','f1000000-0000-4000-8000-000000000003',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000002','clinic','f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','lifecycle-a',null
) session_a \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000004','clinic','f2000000-0000-4000-8000-000000000002',
  'f4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','lifecycle-b',null
) session_b \gset

select * from graftvision_private.create_patient_root(
  :'session_a','f1000000-0000-4000-8000-000000000002',
  'fa000000-0000-4000-8000-000000000001','active','MANUAL_REGISTRATION'
) \gset patient_
select set_config('graftvision.patient_controlled','on',true);
insert into public.patient_registration (
  patient_id, clinic_id, full_name, normalised_name, date_of_birth, phone,
  email, provenance_code, created_by, updated_by
) values (
  :'patient_id','f2000000-0000-4000-8000-000000000001',
  'Synthetic Patient','synthetic patient','1990-01-01','+923001234567',
  'synthetic@example.test','REGISTRATION_FORM',
  'f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002'
);
select set_config('graftvision.patient_controlled','off',true);

select is((select count(*) from public.role_definition),13::bigint,'13-role regression remains');
select is((select count(*) from public.permission_definition),60::bigint,'60-permission regression remains');
select is((select lifecycle_state from public.patient where id=:'patient_id'),'current','patient starts current');

select * from graftvision_private.transition_patient_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id',1,
  'archived','administrative_cleanup','fa000000-0000-4000-8000-000000000003'
) \gset archived_
select is(:'archived_lifecycle_state'::text,'archived'::text,'archive succeeds');
select is(:'archived_lifecycle_revision'::integer,2,'archive increments lifecycle revision once');
select is((select count(*) from public.patient_lifecycle_history where patient_id=:'patient_id'),1::bigint,'archive writes immutable history');
select is((select count(*) from public.audit_event where action='patient.archive' and resource_id=:'patient_id'),1::bigint,'archive writes audit atomically');
select is(jsonb_array_length(graftvision_private.search_patients_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',null,'active',null,null,null,'next',25
)->'patients'),0,'archived patient is excluded from default search');
select is(jsonb_array_length(graftvision_private.search_patients_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',null,'archived',null,null,null,'next',25
)->'patients'),1,'archived filter is explicit');
select is(graftvision_private.read_patient_profile_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id',false,false),null,'archived patient requires explicit profile access');
select ok(graftvision_private.read_patient_profile_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id',false,true) is not null,'archived profile is privacy-safe and explicit');
select throws_ok(format($sql$select * from graftvision_private.transition_patient_lifecycle(
  %L::uuid,%L::uuid,%L::uuid,1,'current','patient_returned',%L::uuid)$sql$,
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id','fa000000-0000-4000-8000-000000000004'),
  '40001','PATIENT_LIFECYCLE_CONFLICT','stale lifecycle revision is rejected');
select throws_ok(format($sql$select * from graftvision_private.transition_patient_lifecycle(
  %L::uuid,%L::uuid,%L::uuid,1,'archived','administrative_cleanup',%L::uuid)$sql$,
  :'session_b','f1000000-0000-4000-8000-000000000004',:'patient_id','fa000000-0000-4000-8000-000000000005'),
  'P0002','PATIENT_NOT_FOUND','Clinic A cannot archive Clinic B patient');
select throws_ok($sql$update public.patient_lifecycle_history set reason_code='archived_in_error'$sql$,
  '55000','CLINIC_STATUS_HISTORY_IMMUTABLE','direct lifecycle history mutation is denied');
select is((select count(*) from public.patient_privacy_acknowledgement where patient_id=:'patient_id'),0::bigint,'privacy acknowledgement is preserved');

select * from graftvision_private.transition_patient_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id',2,
  'current','patient_returned','fa000000-0000-4000-8000-000000000006'
) \gset restored_
select is(:'restored_lifecycle_state'::text,'current'::text,'restore succeeds');
select is((select count(*) from public.patient_lifecycle_history where patient_id=:'patient_id'),2::bigint,'restore appends history');
select * from graftvision_private.transition_patient_lifecycle(
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id',2,
  'current','patient_returned','fa000000-0000-4000-8000-000000000006'
) \gset retry_
select is(:'retry_lifecycle_revision'::integer,3,'idempotent retry returns original transition');
select is((select count(*) from public.patient_lifecycle_history where patient_id=:'patient_id'),2::bigint,'idempotent retry creates no duplicate history or audit');

update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'session_a';
select throws_ok(format($sql$select * from graftvision_private.transition_patient_lifecycle(
  %L::uuid,%L::uuid,%L::uuid,3,'archived','administrative_cleanup',%L::uuid)$sql$,
  :'session_a','f1000000-0000-4000-8000-000000000002',:'patient_id','fa000000-0000-4000-8000-000000000007'),
  '42501','AUTH_PERMISSION_DENIED','locked session is denied');
select is((select lifecycle_state from public.patient where id=:'patient_id'),'current','failed transition rolls back');
select is((select count(*) from public.audit_event where action in ('patient.archive','patient.restore') and resource_id=:'patient_id'),2::bigint,'audit contains no duplicate transition');

select * from finish();
rollback;
