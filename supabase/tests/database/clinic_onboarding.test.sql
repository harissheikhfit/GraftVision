-- CLINIC-005 authoritative onboarding checklist and configuration gate tests.
begin;
select plan(35);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('a2000000-0000-4000-8000-000000000001','onboarding-a','Onboarding Clinic A','active','Asia/Karachi'),
  ('a2000000-0000-4000-8000-000000000002','onboarding-b','Onboarding Clinic B','active','Asia/Karachi');
insert into public.platform_user (id, external_identity_id, status) values
  ('a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','active'),
  ('a1000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000002','active'),
  ('a1000000-0000-4000-8000-000000000003','a9000000-0000-4000-8000-000000000003','active'),
  ('a1000000-0000-4000-8000-000000000004','a9000000-0000-4000-8000-000000000004','active'),
  ('a1000000-0000-4000-8000-000000000005','a9000000-0000-4000-8000-000000000005','active'),
  ('a1000000-0000-4000-8000-000000000006','a9000000-0000-4000-8000-000000000006','active');
insert into public.platform_user_role (platform_user_id, role_code) values
  ('a1000000-0000-4000-8000-000000000005','PLATFORM_OWNER'),
  ('a1000000-0000-4000-8000-000000000006','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','active'),
  ('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','active'),
  ('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','active'),
  ('a3000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','active'),
  ('a3000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000005','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('a3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('a3000000-0000-4000-8000-000000000002','CLINIC_ADMIN'),
  ('a3000000-0000-4000-8000-000000000003','DOCTOR'),
  ('a3000000-0000-4000-8000-000000000004','CLINICAL_ASSISTANT'),
  ('a3000000-0000-4000-8000-000000000005','CLINIC_OWNER');

select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000001','clinic','a2000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','owner',null
) owner_session \gset
select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000002','clinic','a2000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','admin',null
) admin_session \gset
select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000004','clinic','a2000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','assistant',null
) assistant_session \gset
select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000005','clinic','a2000000-0000-4000-8000-000000000002',
  'a4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','owner-b',null
) owner_b_session \gset
select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000005','platform',null,
  'a4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','platform',null
) platform_session \gset
select graftvision_private.create_application_session(
  'a1000000-0000-4000-8000-000000000006','platform',null,
  'a4000000-0000-4000-8000-000000000007',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue remains sixty');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_OWNER' and permission_id='ADMIN-PERM-001'),'Owner has onboarding permission');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='ADMIN-PERM-001'),'Administrator has onboarding permission');
select is((select readiness_state from graftvision_private.read_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001')),'not_ready','initial state is not ready');
select is((select checklist->>'branding_present' from graftvision_private.read_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001')),'true','branding presence is derived');
select is((select checklist->>'verified_doctor' from graftvision_private.read_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001')),'false','Doctor role alone is not verified authority');

select set_config('graftvision.doctor_verification_transition','allowed',true);
insert into public.doctor_verification (
  id, clinic_id, platform_user_id, status, verified_at, expires_at
) values (
  'a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000003','verified',clock_timestamp(),clock_timestamp()+interval '30 days'
);
select set_config('graftvision.doctor_verification_transition','denied',true);
select ok((select verified_doctor from graftvision_private.clinic_onboarding_checks('a2000000-0000-4000-8000-000000000001')),'same-clinic verified Doctor passes');
select is(graftvision_private.attest_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001','SECURITY_READY','attested',0,clock_timestamp()+interval '7 days'),'updated','Owner records security readiness');
select is(graftvision_private.attest_clinic_onboarding(:'admin_session','a1000000-0000-4000-8000-000000000002','PROTOCOL_TEMPLATE_READY','attested',0,null),'updated','Administrator records protocol readiness');
select ok(graftvision_private.is_clinic_ready('a2000000-0000-4000-8000-000000000001'),'all blockers make clinic ready');
select is((select readiness_state from graftvision_private.read_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001')),'ready','readiness state becomes ready');
select is((select count(*) from public.clinic_onboarding_attestation_history where clinic_id='a2000000-0000-4000-8000-000000000001'),2::bigint,'attestations append immutable history');
select is((select count(*) from public.audit_event where action='clinic.onboarding_ready'),1::bigint,'ready transition is audited once');
select is(graftvision_private.attest_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001','SECURITY_READY','attested',0,null),'conflict','stale attestation revision conflicts safely');
select is((select revision from public.clinic_onboarding_attestation where clinic_id='a2000000-0000-4000-8000-000000000001' and attestation_code='SECURITY_READY'),1,'conflict does not overwrite');

select set_config('graftvision.doctor_verification_transition','allowed',true);
update public.doctor_verification set status='revoked',verified_at=null,expires_at=null
where id='a5000000-0000-4000-8000-000000000001';
select set_config('graftvision.doctor_verification_transition','denied',true);
select is(graftvision_private.is_clinic_ready('a2000000-0000-4000-8000-000000000001'),false,'Doctor revocation denies immediately');
select is((select readiness_state from graftvision_private.read_clinic_onboarding(:'owner_session','a1000000-0000-4000-8000-000000000001')),'reopened','failed derived blocker automatically reopens');
select is((select count(*) from public.audit_event where action='clinic.onboarding_reopened'),1::bigint,'reopening is audited once');
select ok((select branding_present and not all_blockers_pass from graftvision_private.clinic_onboarding_checks('a2000000-0000-4000-8000-000000000001')),'branding is non-blocking');

select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'assistant_session','a1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','ordinary role is denied');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'platform_session','a1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','platform session is denied');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'support_session','a1000000-0000-4000-8000-000000000006'),'42501','AUTH_PERMISSION_DENIED','Support Engineer is denied');
select is((select clinic_id from graftvision_private.read_clinic_onboarding(:'owner_b_session','a1000000-0000-4000-8000-000000000005')),'a2000000-0000-4000-8000-000000000002'::uuid,'Clinic B sees only its own checklist');

update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'owner_b_session','a1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
update public.application_session set locked_at=null,lock_reason_code=null,revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ONE' where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'owner_b_session','a1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','revoked session is denied');
update public.application_session set revoked_at=null,revoke_reason_code=null,clinic_authorization_version=0 where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_onboarding(%L::uuid,%L::uuid)$sql$,:'owner_b_session','a1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','stale session is denied');
select throws_ok($$update public.clinic_onboarding_attestation set status='withdrawn'$$,'55000','CLINIC_ONBOARDING_CONTROLLED_MUTATION_REQUIRED','direct attestation mutation is denied');
select throws_ok($$delete from public.clinic_onboarding_attestation_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','attestation history is immutable');
select throws_ok($$delete from public.clinic_onboarding_readiness_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','readiness history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_onboarding_attestation'::regclass),'attestations enable and force RLS');
select ok(not exists(select 1 from public.audit_event where action like 'clinic.onboarding_%' and metadata::text ~* '(token|cookie|password|patient|request|email|protocol_contents|note)'),'audit metadata excludes sensitive data');
select is((select count(*) from public.clinic_onboarding_attestation_history where clinic_id='a2000000-0000-4000-8000-000000000001'),2::bigint,'failed update creates no history');
select is((select state from public.clinic_onboarding_readiness where clinic_id='a2000000-0000-4000-8000-000000000001'),'reopened','stored state records prior readiness loss');
select is((select count(*) from public.clinic_onboarding_readiness_history where clinic_id='a2000000-0000-4000-8000-000000000001'),2::bigint,'ready and reopened transitions have immutable history');

rollback;
