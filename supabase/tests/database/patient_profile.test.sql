-- PATIENT-004 masked profile and curated timeline tests. Synthetic data only.
begin;
select plan(23);

insert into public.clinic (id,clinic_code,display_name,status,timezone) values
 ('e2000000-0000-4000-8000-000000000001','profile-a','Synthetic Profile A','active','Asia/Karachi'),
 ('e2000000-0000-4000-8000-000000000002','profile-b','Synthetic Profile B','active','Asia/Karachi'),
 ('e2000000-0000-4000-8000-000000000003','profile-c','Synthetic Profile Not Ready','active','Asia/Karachi');
insert into public.platform_user (id,external_identity_id,status) values
 ('e1000000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001','active'),
 ('e1000000-0000-4000-8000-000000000002','e9000000-0000-4000-8000-000000000002','active'),
 ('e1000000-0000-4000-8000-000000000003','e9000000-0000-4000-8000-000000000003','active'),
 ('e1000000-0000-4000-8000-000000000004','e9000000-0000-4000-8000-000000000004','active'),
 ('e1000000-0000-4000-8000-000000000005','e9000000-0000-4000-8000-000000000005','active'),
 ('e1000000-0000-4000-8000-000000000006','e9000000-0000-4000-8000-000000000006','active');
insert into public.platform_user_role(platform_user_id,role_code) values
 ('e1000000-0000-4000-8000-000000000006','PLATFORM_SUPPORT');
insert into public.clinic_membership(id,clinic_id,platform_user_id,membership_status) values
 ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','active'),
 ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','active'),
 ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','active'),
 ('e3000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000004','active'),
 ('e3000000-0000-4000-8000-000000000005','e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000005','active');
insert into public.clinic_membership_role(clinic_membership_id,role_code) values
 ('e3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
 ('e3000000-0000-4000-8000-000000000001','DOCTOR'),
 ('e3000000-0000-4000-8000-000000000002','RECEPTION'),
 ('e3000000-0000-4000-8000-000000000003','DOCTOR'),
 ('e3000000-0000-4000-8000-000000000004','CLINIC_OWNER'),
 ('e3000000-0000-4000-8000-000000000004','DOCTOR'),
 ('e3000000-0000-4000-8000-000000000005','CLINIC_OWNER');
select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification(id,clinic_id,platform_user_id,status,verified_at,expires_at) values
 ('e5000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
 ('e5000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000004','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);
select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation(clinic_id,attestation_code,status,actor_platform_user_id,revision) values
 ('e2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','e1000000-0000-4000-8000-000000000001',1),
 ('e2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','e1000000-0000-4000-8000-000000000001',1),
 ('e2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','e1000000-0000-4000-8000-000000000004',1),
 ('e2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','e1000000-0000-4000-8000-000000000004',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);
select graftvision_private.create_application_session('e1000000-0000-4000-8000-000000000002','clinic','e2000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','profile-a',null) profile_a_session \gset
select graftvision_private.create_application_session('e1000000-0000-4000-8000-000000000003','clinic','e2000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','doctor-unverified',null) unverified_session \gset
select graftvision_private.create_application_session('e1000000-0000-4000-8000-000000000004','clinic','e2000000-0000-4000-8000-000000000002','e4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','profile-b',null) profile_b_session \gset
select graftvision_private.create_application_session('e1000000-0000-4000-8000-000000000005','clinic','e2000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','not-ready',null) not_ready_session \gset
select graftvision_private.create_application_session('e1000000-0000-4000-8000-000000000006','platform',null,'e4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','support',null) support_session \gset

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient(id,clinic_id,patient_number,status,revision,provenance_code,created_at,updated_at,created_by,updated_by) values
 ('ea000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','GV-000001','active',1,'MANUAL_REGISTRATION','2026-07-20','2026-07-21','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002'),
 ('ea000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','GV-000002','inactive',2,'MANUAL_REGISTRATION','2026-07-22','2026-07-23','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002'),
 ('eb000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','GV-000001','active',1,'MANUAL_REGISTRATION','2026-07-20','2026-07-20','e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000004');
insert into public.patient_registration(patient_id,clinic_id,full_name,normalised_name,date_of_birth,phone,email,provenance_code,created_by,updated_by) values
 ('ea000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','Synthetic Alpha','synthetic alpha','1990-04-05','+923001234567','alpha@example.test','REGISTRATION_FORM','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002'),
 ('ea000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','Inactive Alpha','inactive alpha','1980-02-03','+923009999999',null,'REGISTRATION_FORM','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002'),
 ('eb000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','Foreign Patient','foreign patient','1970-01-02','+923008888888','foreign@example.test','REGISTRATION_FORM','e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000004');
insert into public.patient_status_history(id,patient_id,clinic_id,previous_status,new_status,action_code,previous_revision,new_revision,provenance_code,actor_platform_user_id,occurred_at) values
 ('ec000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',null,'active','created',0,1,'MANUAL_REGISTRATION','e1000000-0000-4000-8000-000000000002','2026-07-20'),
 ('ec000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','active','inactive','status_changed',1,2,'MANUAL_REGISTRATION','e1000000-0000-4000-8000-000000000002','2026-07-23');
insert into public.patient_registration_history(id,clinic_id,patient_id,registration_revision,action_code,provenance_code,actor_platform_user_id,occurred_at) values
 ('ed000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001',1,'registration_created','REGISTRATION_FORM','e1000000-0000-4000-8000-000000000002','2026-07-21');
insert into public.patient_duplicate_decision_history(id,clinic_id,patient_id,request_key_hash,decision_code,match_reason_codes,override_reason_code,actor_platform_user_id,occurred_at) values
 ('ee000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001',extensions.digest('profile','sha256'),'override',array['PHONE_EXACT'],'CONFIRMED_DISTINCT_PERSON','e1000000-0000-4000-8000-000000000002','2026-07-22');
select set_config('graftvision.patient_controlled','off',true);

select graftvision_private.read_patient_profile(:'profile_a_session','e1000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001',false) result \gset
select is(:'result'::jsonb->'profile'->>'patientNumber','GV-000001','valid same-clinic profile is returned');
select is(:'result'::jsonb->'profile'->>'maskedDateOfBirth','1990','date of birth is reduced to year');
select ok((:'result'::jsonb->'profile'->>'maskedName') like 'S%','name is masked');
select ok((:'result'::jsonb->'profile'->>'maskedPhone') like '%67','phone is masked');
select is(:'result'::jsonb->'profile'->>'maskedEmail','a•••@example.test','email is masked');
select ok(not (:'result'::jsonb)::text ~* '(Synthetic Alpha|923001234567|normalised|actor_platform|provenance|audit|idempotency)','projection excludes raw identity and internals');
select is(jsonb_array_length(:'result'::jsonb->'timeline'),3,'only curated patient events are returned');
select is(:'result'::jsonb->'timeline'->0->>'eventCode','DUPLICATE_OVERRIDE','timeline is newest first');
select ok(not (:'result'::jsonb->'timeline')::text ~* '(login|session|clinic|staff|metadata|request_body)','timeline excludes non-patient and raw audit content');
select is(graftvision_private.read_patient_profile(:'profile_a_session','e1000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000002',false),null,'inactive patient is hidden by default');
select is(graftvision_private.read_patient_profile(:'profile_a_session','e1000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000002',true)->'profile'->>'status','inactive','inactive profile requires explicit request');
select is(graftvision_private.read_patient_profile(:'profile_a_session','e1000000-0000-4000-8000-000000000002','eb000000-0000-4000-8000-000000000001',true),null,'Clinic A cannot discover Clinic B patient');
select is(graftvision_private.read_patient_profile(:'profile_b_session','e1000000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000001',true),null,'Clinic B cannot discover Clinic A patient');
select is(graftvision_private.read_patient_profile(:'profile_a_session','e1000000-0000-4000-8000-000000000002','ea999999-0000-4000-8000-000000000001',false),null,'unknown patient returns no existence detail');
select throws_ok(format($sql$select graftvision_private.read_patient_profile(%L::uuid,%L::uuid,%L::uuid,false)$sql$,:'unverified_session','e1000000-0000-4000-8000-000000000003','ea000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','unverified Doctor is denied');
select throws_ok(format($sql$select graftvision_private.read_patient_profile(%L::uuid,%L::uuid,%L::uuid,false)$sql$,:'support_session','e1000000-0000-4000-8000-000000000006','ea000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','Support patient profile access is denied');
select throws_ok(format($sql$select graftvision_private.read_patient_profile(%L::uuid,%L::uuid,%L::uuid,false)$sql$,:'not_ready_session','e1000000-0000-4000-8000-000000000005','ea000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','not-ready clinic is denied');
select set_config('graftvision.session_controlled','on',true);
update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'profile_a_session';
select set_config('graftvision.session_controlled','off',true);
select throws_ok(format($sql$select graftvision_private.read_patient_profile(%L::uuid,%L::uuid,%L::uuid,false)$sql$,:'profile_a_session','e1000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
select ok(not has_function_privilege('authenticated','graftvision_private.read_patient_profile(uuid,uuid,uuid,boolean)','execute'),'direct browser/database profile execution is denied');
select is((select count(*) from public.audit_event where metadata::text ~* '(Synthetic Alpha|923001234567|alpha@example|date_of_birth|timeline)'),0::bigint,'profile access emits no sensitive audit metadata');
select is((select count(*) from public.permission_definition),60::bigint,'60-permission catalogue is unchanged');
select is((select count(*) from public.role_definition),13::bigint,'13-role catalogue is unchanged');
select ok((:'result'::jsonb->'profile') ?& array['id','patientNumber','maskedName','maskedDateOfBirth','maskedPhone','maskedEmail','status','revision','registeredAt','updatedAt'],'profile contains only approved summary fields');

select * from finish();
rollback;
