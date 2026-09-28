-- PATIENT-005 registration/privacy acknowledgement tests. Synthetic data only.
begin;
select plan(34);

insert into public.clinic (id,clinic_code,display_name,status,timezone) values
 ('f2000000-0000-4000-8000-000000000001','consent-a','Synthetic Consent A','active','Asia/Karachi'),
 ('f2000000-0000-4000-8000-000000000002','consent-b','Synthetic Consent B','active','Asia/Karachi'),
 ('f2000000-0000-4000-8000-000000000003','consent-c','Synthetic Consent Not Ready','active','Asia/Karachi');
insert into public.platform_user (id,external_identity_id,status) values
 ('f1000000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000001','active'),
 ('f1000000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000002','active'),
 ('f1000000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000003','active'),
 ('f1000000-0000-4000-8000-000000000004','f9000000-0000-4000-8000-000000000004','active'),
 ('f1000000-0000-4000-8000-000000000005','f9000000-0000-4000-8000-000000000005','active');
insert into public.platform_user_role(platform_user_id,role_code) values
 ('f1000000-0000-4000-8000-000000000005','PLATFORM_SUPPORT');
insert into public.clinic_membership(id,clinic_id,platform_user_id,membership_status) values
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','active'),
 ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','active'),
 ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','active'),
 ('f3000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004','active');
insert into public.clinic_membership_role(clinic_membership_id,role_code) values
 ('f3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
 ('f3000000-0000-4000-8000-000000000001','DOCTOR'),
 ('f3000000-0000-4000-8000-000000000002','DOCTOR'),
 ('f3000000-0000-4000-8000-000000000003','CLINIC_OWNER'),
 ('f3000000-0000-4000-8000-000000000003','DOCTOR'),
 ('f3000000-0000-4000-8000-000000000004','CLINIC_OWNER');
select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification(id,clinic_id,platform_user_id,status,verified_at,expires_at) values
 ('f5000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
 ('f5000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);
select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation(clinic_id,attestation_code,status,actor_platform_user_id,revision) values
 ('f2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','f1000000-0000-4000-8000-000000000001',1),
 ('f2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','f1000000-0000-4000-8000-000000000001',1),
 ('f2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','f1000000-0000-4000-8000-000000000003',1),
 ('f2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','f1000000-0000-4000-8000-000000000003',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);
select graftvision_private.create_application_session('f1000000-0000-4000-8000-000000000001','clinic','f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','consent-a',null) consent_a_session \gset
select graftvision_private.create_application_session('f1000000-0000-4000-8000-000000000002','clinic','f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','unverified',null) unverified_session \gset
select graftvision_private.create_application_session('f1000000-0000-4000-8000-000000000003','clinic','f2000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','consent-b',null) consent_b_session \gset
select graftvision_private.create_application_session('f1000000-0000-4000-8000-000000000004','clinic','f2000000-0000-4000-8000-000000000003','f4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','not-ready',null) not_ready_session \gset
select graftvision_private.create_application_session('f1000000-0000-4000-8000-000000000005','platform',null,'f4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','support',null) support_session \gset

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient(id,clinic_id,patient_number,status,provenance_code,created_by,updated_by) values
 ('fa000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','GV-000001','active','MANUAL_REGISTRATION','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001'),
 ('fb000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','GV-000001','active','MANUAL_REGISTRATION','f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003');
select set_config('graftvision.patient_controlled','off',true);

select set_config('graftvision.privacy_notice_controlled','on',true);
insert into public.privacy_notice_version(notice_version_id,notice_pair_id,purpose_code,semantic_version,language,content_reference,content_hash,effective_date) values
 ('fc000000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001','REGISTRATION_PRIVACY','1.0','en','notice://registration-privacy/synthetic/1.0/en',extensions.digest('synthetic-en','sha256'),current_date-1),
 ('fc000000-0000-4000-8000-000000000002','fd000000-0000-4000-8000-000000000001','REGISTRATION_PRIVACY','1.0','ur','notice://registration-privacy/synthetic/1.0/ur',extensions.digest('synthetic-ur','sha256'),current_date-1),
 ('fc000000-0000-4000-8000-000000000003','fd000000-0000-4000-8000-000000000002','REGISTRATION_PRIVACY','2.0','en','notice://registration-privacy/synthetic/2.0/en',extensions.digest('synthetic-en-2','sha256'),current_date-1),
 ('fc000000-0000-4000-8000-000000000004','fd000000-0000-4000-8000-000000000002','REGISTRATION_PRIVACY','2.0','ur','notice://registration-privacy/synthetic/2.0/ur',extensions.digest('synthetic-ur-2','sha256'),current_date-1),
 ('fc000000-0000-4000-8000-000000000005','fd000000-0000-4000-8000-000000000003','REGISTRATION_PRIVACY','3.0','en','notice://registration-privacy/synthetic/3.0/en',extensions.digest('synthetic-en-3','sha256'),current_date-1);
select set_config('graftvision.privacy_notice_controlled','off',true);

select is(jsonb_array_length(graftvision_private.read_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001')->'notices'),4,'English and Urdu parity exposes only complete notice pairs');
select is(graftvision_private.read_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001')->'current','null'::jsonb,'privacy acknowledgement begins pending without a mutable row');
select graftvision_private.record_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000001',0,null,null) acknowledged \gset
select is(:'acknowledged'::jsonb->>'status','acknowledged','privacy notice acknowledgement succeeds');
select is((:'acknowledged'::jsonb->>'revision')::integer,1,'initial acknowledgement has revision one');
select is((select count(*) from public.patient_privacy_acknowledgement_history),1::bigint,'acknowledgement appends immutable history');
select is((select count(*) from public.audit_event where action='patient.privacy_acknowledge'),1::bigint,'acknowledgement writes controlled audit evidence');
select is(graftvision_private.record_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000001',0,null,null),:'acknowledged'::jsonb,'acknowledgement retry is idempotent');
select is((select count(*) from public.patient_privacy_acknowledgement_history),1::bigint,'idempotent retry creates no duplicate history');
select throws_ok(format($sql$select graftvision_private.record_patient_privacy_acknowledgement(%L::uuid,'f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002','ur','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000001',1,null,null)$sql$,:'consent_a_session'),'22023','IDEMPOTENCY_KEY_REUSED','changed payload with same key is denied');
select throws_ok(format($sql$select graftvision_private.record_patient_privacy_acknowledgement(%L::uuid,'f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000005','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000002',1,null,null)$sql$,:'consent_a_session'),'22023','NOTICE_PARITY_REQUIRED','unpaired notice version is denied');
select throws_ok(format($sql$select graftvision_private.record_patient_privacy_acknowledgement(%L::uuid,'f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000003',1,'GUARDIAN','ff000000-0000-4000-8000-000000000001')$sql$,:'consent_a_session'),'42501','REPRESENTATIVE_AUTHORITY_NOT_VERIFIED','representative denial without verified authority');
select throws_ok(format($sql$select graftvision_private.record_patient_privacy_acknowledgement(%L::uuid,'f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000004',0,null,null)$sql$,:'consent_a_session'),'40001','PRIVACY_ACKNOWLEDGEMENT_CONFLICT','stale acknowledgement revision is denied');
select graftvision_private.record_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000003','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000007',1,null,null) superseded \gset
select is(:'superseded'::jsonb->>'status','acknowledged','new notice version becomes current acknowledgement');
select is((:'superseded'::jsonb->>'revision')::integer,2,'notice supersession increments current revision once');
select is((select count(*) from public.patient_privacy_acknowledgement_history where new_status='superseded'),1::bigint,'notice supersession appends an immutable transition');
select is((select notice_version_id from public.patient_privacy_acknowledgement where patient_id='fa000000-0000-4000-8000-000000000001'),'fc000000-0000-4000-8000-000000000003'::uuid,'notice supersession preserves the exact new version');
select throws_ok(format($sql$select graftvision_private.record_patient_privacy_acknowledgement(%L::uuid,'f1000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','en','IN_PERSON_CLINIC','fe000000-0000-4000-8000-000000000005',0,null,null)$sql$,:'consent_a_session'),'42501','PATIENT_CONTEXT_DENIED','same-clinic isolation denies foreign patient');
select throws_ok(format($sql$select graftvision_private.read_patient_privacy_acknowledgement(%L::uuid,%L::uuid,%L::uuid)$sql$,:'unverified_session','f1000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','unverified Doctor is denied');
select throws_ok(format($sql$select graftvision_private.read_patient_privacy_acknowledgement(%L::uuid,%L::uuid,%L::uuid)$sql$,:'support_session','f1000000-0000-4000-8000-000000000005','fa000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','Support access is denied');
select throws_ok(format($sql$select graftvision_private.read_patient_privacy_acknowledgement(%L::uuid,%L::uuid,%L::uuid)$sql$,:'not_ready_session','f1000000-0000-4000-8000-000000000004','fa000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','not-ready clinic is denied');
select set_config('graftvision.session_controlled','on',true);
update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'consent_a_session';
select set_config('graftvision.session_controlled','off',true);
select throws_ok(format($sql$select graftvision_private.read_patient_privacy_acknowledgement(%L::uuid,%L::uuid,%L::uuid)$sql$,:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
select set_config('graftvision.session_controlled','on',true);
update public.application_session set locked_at=null,lock_reason_code=null where id=:'consent_a_session';
select set_config('graftvision.session_controlled','off',true);
select graftvision_private.withdraw_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',2,'PATIENT_REQUEST','fe000000-0000-4000-8000-000000000006',null,null) withdrawn \gset
select is(:'withdrawn'::jsonb->>'status','withdrawn','withdrawal is recorded prospectively');
select is((:'withdrawn'::jsonb->>'revision')::integer,3,'withdrawal increments revision exactly once');
select is((select count(*) from public.patient_privacy_acknowledgement_history),4::bigint,'withdrawal preserves immutable history');
select is((select count(*) from public.audit_event where action='patient.privacy_withdraw'),1::bigint,'withdrawal writes controlled audit evidence');
select is(graftvision_private.withdraw_patient_privacy_acknowledgement(:'consent_a_session','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',2,'PATIENT_REQUEST','fe000000-0000-4000-8000-000000000006',null,null),:'withdrawn'::jsonb,'withdrawal retry is idempotent');
select throws_ok($sql$update public.patient_privacy_acknowledgement_history set new_status='pending'$sql$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','history is immutable');
select ok(not has_function_privilege('authenticated','graftvision_private.record_patient_privacy_acknowledgement(uuid,uuid,uuid,uuid,text,text,uuid,integer,text,uuid)','execute'),'direct browser acknowledgement execution is denied');
select ok(not has_table_privilege('authenticated','public.patient_privacy_acknowledgement','insert'),'direct browser table mutation is denied');
select is((select count(*) from public.audit_event where action like 'patient.privacy_%' and metadata::text ~* '(signature|document|biometric|cnic|request_body|token|cookie|note)'),0::bigint,'audit metadata excludes prohibited evidence');
select is((select count(*) from public.permission_definition),60::bigint,'60-permission catalogue is unchanged');
select is((select count(*) from public.role_definition),13::bigint,'13-role catalogue is unchanged');
select is((select purpose_code from public.patient_privacy_acknowledgement where patient_id='fa000000-0000-4000-8000-000000000001'),'REGISTRATION_PRIVACY','purpose isolation is enforced');
select ok(not exists(select 1 from information_schema.tables where table_schema='public' and table_name in ('patient_treatment_consent','patient_resource_acknowledgement')),'treatment and resource acknowledgement concepts are not implemented');

select * from finish();
rollback;
