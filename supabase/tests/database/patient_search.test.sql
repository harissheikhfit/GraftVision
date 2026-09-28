-- PATIENT-003 controlled list/search tests. Synthetic data only.
begin;
select plan(27);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('d2000000-0000-4000-8000-000000000001','search-a','Synthetic Search Clinic A','active','Asia/Karachi'),
  ('d2000000-0000-4000-8000-000000000002','search-b','Synthetic Search Clinic B','active','Asia/Karachi'),
  ('d2000000-0000-4000-8000-000000000003','search-not-ready','Synthetic Not Ready Clinic','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('d1000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000001','active'),
  ('d1000000-0000-4000-8000-000000000002','d9000000-0000-4000-8000-000000000002','active'),
  ('d1000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000003','active'),
  ('d1000000-0000-4000-8000-000000000004','d9000000-0000-4000-8000-000000000004','active'),
  ('d1000000-0000-4000-8000-000000000005','d9000000-0000-4000-8000-000000000005','active'),
  ('d1000000-0000-4000-8000-000000000006','d9000000-0000-4000-8000-000000000006','active');
insert into public.platform_user_role (platform_user_id, role_code) values
  ('d1000000-0000-4000-8000-000000000006','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','active'),
  ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','active'),
  ('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003','active'),
  ('d3000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000004','active'),
  ('d3000000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000005','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('d3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('d3000000-0000-4000-8000-000000000001','DOCTOR'),
  ('d3000000-0000-4000-8000-000000000002','RECEPTION'),
  ('d3000000-0000-4000-8000-000000000003','DOCTOR'),
  ('d3000000-0000-4000-8000-000000000004','CLINIC_OWNER'),
  ('d3000000-0000-4000-8000-000000000004','DOCTOR'),
  ('d3000000-0000-4000-8000-000000000005','CLINIC_OWNER');
select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values
  ('d5000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','verified',clock_timestamp(),clock_timestamp()+interval '30 days'),
  ('d5000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000004','verified',clock_timestamp(),clock_timestamp()+interval '30 days');
select set_config('graftvision.doctor_verification_transition','denied',true);
select set_config('graftvision.clinic_onboarding_controlled','on',true);
insert into public.clinic_onboarding_attestation (
  clinic_id, attestation_code, status, actor_platform_user_id, revision
) values
  ('d2000000-0000-4000-8000-000000000001','SECURITY_READY','attested','d1000000-0000-4000-8000-000000000001',1),
  ('d2000000-0000-4000-8000-000000000001','PROTOCOL_TEMPLATE_READY','attested','d1000000-0000-4000-8000-000000000001',1),
  ('d2000000-0000-4000-8000-000000000002','SECURITY_READY','attested','d1000000-0000-4000-8000-000000000004',1),
  ('d2000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested','d1000000-0000-4000-8000-000000000004',1);
select set_config('graftvision.clinic_onboarding_controlled','off',true);

select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000002','clinic','d2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','search-a',null
) search_a_session \gset
select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000003','clinic','d2000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','unverified-doctor',null
) unverified_session \gset
select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000004','clinic','d2000000-0000-4000-8000-000000000002',
  'd4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','search-b',null
) search_b_session \gset
select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000005','clinic','d2000000-0000-4000-8000-000000000003',
  'd4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','not-ready',null
) not_ready_session \gset
select graftvision_private.create_application_session(
  'd1000000-0000-4000-8000-000000000006','platform',null,
  'd4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select set_config('graftvision.patient_controlled','on',true);
insert into public.patient (
  id, clinic_id, patient_number, status, provenance_code, revision, created_at, created_by, updated_by
) values
  ('da000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','GV-000001','active','MANUAL_REGISTRATION',1,'2026-07-20','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('da000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','GV-000002','active','MANUAL_REGISTRATION',1,'2026-07-21','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('da000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','GV-000003','inactive','MANUAL_REGISTRATION',2,'2026-07-22','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('db000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','GV-000001','active','MANUAL_REGISTRATION',1,'2026-07-23','d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004');
insert into public.patient_registration (
  patient_id, clinic_id, full_name, normalised_name, date_of_birth, phone, email,
  provenance_code, created_by, updated_by
) values
  ('da000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Alpha Person','alpha person','1990-01-01','+923001111111','alpha@example.test','REGISTRATION_FORM','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('da000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Beta Person','beta person','1991-01-01','+923002222222','beta@example.test','REGISTRATION_FORM','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('da000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','Inactive Person','inactive person','1992-01-01','+923003333333','inactive@example.test','REGISTRATION_FORM','d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
  ('db000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','Foreign Person','foreign person','1993-01-01','+923004444444','foreign@example.test','REGISTRATION_FORM','d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004');
select set_config('graftvision.patient_controlled','off',true);

select graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002') page \gset
select is(jsonb_array_length(:'page'::jsonb->'patients'),2,'active patients are returned by default');
select is(:'page'::jsonb->'patients'->0->>'patientNumber','GV-000002','newest patients sort first');
select ok(not (:'page'::jsonb)::text ~* '(Alpha Person|Beta Person|923001111111|alpha@example)','result projection masks identity and contact values');
select ok((:'page'::jsonb->'patients'->0) ?& array['id','patientNumber','maskedName','hasPhone','hasEmail','status','revision','createdAt'],'minimal projection fields are present');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002','GV-000001')->'patients'),1,'patient number exact/prefix search works');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',' alp ')->'patients'),1,'normalised name prefix search works');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002','+92 (300) 111-1111')->'patients'),1,'normalised phone search works');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002','BETA@EXAMPLE')->'patients'),1,'normalised email prefix search works');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',null,'inactive')->'patients'),1,'inactive filter must be explicit');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',null,'active','2026-07-21','2026-07-21')->'patients'),1,'created date range is bounded');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002','foreign')->'patients'),0,'Clinic A cannot discover Clinic B by name');
select is(jsonb_array_length(graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002','+923004444444')->'patients'),0,'Clinic A cannot discover Clinic B by phone');

select graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',null,'active',null,null,null,'next',1) first_page \gset
select is(jsonb_array_length(:'first_page'::jsonb->'patients'),1,'cursor page size is enforced');
select ok(:'first_page'::jsonb->>'nextCursor' is not null,'next cursor is returned when more results exist');
select set_config('graftvision.patient_controlled','on',true);
insert into public.patient (
  id, clinic_id, patient_number, status, provenance_code, revision, created_at, created_by, updated_by
) values (
  'da000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001',
  'GV-000004','active','MANUAL_REGISTRATION',1,'2026-07-24',
  'd1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'
);
insert into public.patient_registration (
  patient_id, clinic_id, full_name, normalised_name, date_of_birth, phone,
  provenance_code, created_by, updated_by
) values (
  'da000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001',
  'Concurrent Person','concurrent person','1994-01-01','+923005555555','REGISTRATION_FORM',
  'd1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'
);
select set_config('graftvision.patient_controlled','off',true);
select graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',null,'active',null,null,:'first_page'::jsonb->>'nextCursor','next',1) second_page \gset
select is(:'second_page'::jsonb->'patients'->0->>'patientNumber','GV-000001','concurrent insert does not destabilise the next cursor page');
select ok(:'second_page'::jsonb->>'previousCursor' is not null,'previous cursor is returned');
select graftvision_private.search_patients(:'search_a_session','d1000000-0000-4000-8000-000000000002',null,'active',null,null,:'second_page'::jsonb->>'previousCursor','previous',1) previous_page \gset
select is(:'previous_page'::jsonb->'patients'->0->>'patientNumber','GV-000002','previous cursor returns stable prior row');
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid,null,'active',null,null,'forged','next',25)$sql$,:'search_a_session','d1000000-0000-4000-8000-000000000002'),'22023','INVALID_PATIENT_CURSOR','malformed cursor is rejected');
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid,null,'active',null,null,%L,'next',25)$sql$,:'search_b_session','d1000000-0000-4000-8000-000000000004',:'first_page'::jsonb->>'nextCursor'),'22023','INVALID_PATIENT_CURSOR','cross-clinic cursor is rejected');
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid)$sql$,:'unverified_session','d1000000-0000-4000-8000-000000000003'),'42501','AUTH_PERMISSION_DENIED','unverified Doctor is denied');
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid)$sql$,:'support_session','d1000000-0000-4000-8000-000000000006'),'42501','AUTH_PERMISSION_DENIED','Support ordinary patient access is denied');
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid)$sql$,:'not_ready_session','d1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','not-ready clinic is denied');
select set_config('graftvision.session_controlled','on',true);
update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'search_a_session';
select set_config('graftvision.session_controlled','off',true);
select throws_ok(format($sql$select graftvision_private.search_patients(%L::uuid,%L::uuid)$sql$,:'search_a_session','d1000000-0000-4000-8000-000000000002'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
select ok(not has_function_privilege('authenticated','graftvision_private.search_patients(uuid,uuid,text,text,date,date,text,text,integer)','execute'),'direct browser/database execution is denied');
select is((select count(*) from public.audit_event where action like 'patient.%' and metadata::text ~* '(Alpha Person|923001111111|alpha@example|search_term)'),0::bigint,'search emits no sensitive audit metadata');
select is((select count(*) from public.permission_definition),60::bigint,'60-permission catalogue is unchanged');
select is((select count(*) from public.role_definition),13::bigint,'13-role catalogue is unchanged');

select * from finish();
rollback;
