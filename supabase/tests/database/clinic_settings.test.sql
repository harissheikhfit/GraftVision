-- CLINIC-002 typed clinic settings and concurrency tests.
begin;
select plan(35);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('f2000000-0000-4000-8000-000000000001','settings-a','Settings Clinic A','active','Asia/Karachi'),
  ('f2000000-0000-4000-8000-000000000002','settings-b','Settings Clinic B','active','Asia/Dubai');

insert into public.platform_user (id, external_identity_id, status) values
  ('f1000000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000001','active'),
  ('f1000000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000002','active'),
  ('f1000000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000003','active'),
  ('f1000000-0000-4000-8000-000000000004','f9000000-0000-4000-8000-000000000004','active'),
  ('f1000000-0000-4000-8000-000000000005','f9000000-0000-4000-8000-000000000005','active'),
  ('f1000000-0000-4000-8000-000000000006','f9000000-0000-4000-8000-000000000006','active');

insert into public.platform_user_role (platform_user_id, role_code) values
  ('f1000000-0000-4000-8000-000000000005','PLATFORM_OWNER'),
  ('f1000000-0000-4000-8000-000000000006','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','active'),
  ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','active'),
  ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000003','active'),
  ('f3000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000004','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('f3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('f3000000-0000-4000-8000-000000000002','CLINIC_ADMIN'),
  ('f3000000-0000-4000-8000-000000000003','CLINICAL_ASSISTANT'),
  ('f3000000-0000-4000-8000-000000000004','CLINIC_OWNER');

select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000001','clinic','f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','owner-a',null
) owner_session \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000002','clinic','f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','admin-a',null
) admin_session \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000003','clinic','f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','assistant-a',null
) assistant_session \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000004','clinic','f2000000-0000-4000-8000-000000000002',
  'f4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','owner-b',null
) owner_b_session \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000005','platform',null,
  'f4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','platform',null
) platform_session \gset
select graftvision_private.create_application_session(
  'f1000000-0000-4000-8000-000000000006','platform',null,
  'f4000000-0000-4000-8000-000000000006',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue remains sixty');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_OWNER' and permission_id='ADMIN-PERM-001'),'Owner has settings permission');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='ADMIN-PERM-001'),'Administrator has settings permission');
select is((select clinic_code from graftvision_private.read_clinic_settings(:'owner_session','f1000000-0000-4000-8000-000000000001')),'settings-a','Owner reads immutable clinic code');
select is(graftvision_private.update_clinic_settings(
  :'owner_session','f1000000-0000-4000-8000-000000000001',1,
  'Updated Settings Clinic A','Asia/Dubai','PROFILE_UPDATED'
),'updated','valid profile update succeeds');
select is((select display_name from public.clinic where id='f2000000-0000-4000-8000-000000000001'),'Updated Settings Clinic A','display name updates');
select is((select revision from public.clinic where id='f2000000-0000-4000-8000-000000000001'),2,'revision increments exactly once');
select is((select count(*) from public.clinic_settings_history where clinic_id='f2000000-0000-4000-8000-000000000001'),1::bigint,'success appends history');
select is((select count(*) from public.audit_event where action='clinic.settings_update' and clinic_id='f2000000-0000-4000-8000-000000000001'),1::bigint,'success writes audit');
select is(graftvision_private.update_clinic_settings(
  :'owner_session','f1000000-0000-4000-8000-000000000001',1,
  'Stale overwrite','Asia/Karachi','PROFILE_UPDATED'
),'conflict','stale revision returns privacy-safe conflict');
select is((select revision from public.clinic where id='f2000000-0000-4000-8000-000000000001'),2,'conflict does not mutate revision');
select is((select count(*) from public.audit_event where action='clinic.settings_conflict'),1::bigint,'conflict writes denied audit only');
select throws_ok(format($sql$select graftvision_private.update_clinic_settings(%L::uuid,%L::uuid,2,'test','Asia/Karachi','PROFILE_UPDATED')$sql$,:'owner_session','f1000000-0000-4000-8000-000000000001'),'22023','INVALID_CLINIC_NAME','invalid name is rejected');
select throws_ok(format($sql$select graftvision_private.update_clinic_settings(%L::uuid,%L::uuid,2,'Valid Clinic','Not/A_Timezone','PROFILE_UPDATED')$sql$,:'owner_session','f1000000-0000-4000-8000-000000000001'),'22023','INVALID_CLINIC_TIMEZONE','invalid timezone is rejected');
select throws_ok($$update public.clinic set clinic_code='changed' where id='f2000000-0000-4000-8000-000000000001'$$,'55000','CLINIC_CODE_IMMUTABLE','clinic code is immutable');
select is(graftvision_private.update_clinic_settings(:'admin_session','f1000000-0000-4000-8000-000000000002',2,'Administrator Update','Asia/Karachi','PROFILE_UPDATED'),'updated','Clinic Administrator may update');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'assistant_session','f1000000-0000-4000-8000-000000000003'),'42501','AUTH_PERMISSION_DENIED','other clinic role is denied');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'platform_session','f1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','platform session is denied ordinary settings');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'support_session','f1000000-0000-4000-8000-000000000006'),'42501','AUTH_PERMISSION_DENIED','Support Engineer is denied ordinary settings');
select is((select clinic_code from graftvision_private.read_clinic_settings(:'owner_b_session','f1000000-0000-4000-8000-000000000004')),'settings-b','Clinic B sees only Clinic B settings');

update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
update public.application_session set locked_at=null,lock_reason_code=null where id=:'owner_b_session';
update public.application_session set revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ONE' where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','revoked session is denied');
update public.application_session set revoked_at=null,revoke_reason_code=null,absolute_expires_at=clock_timestamp()-interval '1 second' where id=:'owner_b_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','expired session is denied');
update public.application_session set absolute_expires_at=clock_timestamp()+interval '1 hour' where id=:'owner_b_session';
update public.platform_user set status='suspended' where id='f1000000-0000-4000-8000-000000000004';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','inactive user is denied');
update public.platform_user set status='active' where id='f1000000-0000-4000-8000-000000000004';
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='suspended' where id='f2000000-0000-4000-8000-000000000002';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','suspended clinic is denied');
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='active' where id='f2000000-0000-4000-8000-000000000002';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
update public.clinic_membership set membership_status='suspended' where id='f3000000-0000-4000-8000-000000000004';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','inactive membership is denied');
update public.clinic_membership set membership_status='active',authorization_version=authorization_version+1 where id='f3000000-0000-4000-8000-000000000004';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_settings(%L::uuid,%L::uuid)$sql$,:'owner_b_session','f1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','stale session is denied');
select throws_ok($$update public.clinic set display_name='Direct Write' where id='f2000000-0000-4000-8000-000000000001'$$,'55000','CLINIC_SETTINGS_CONTROLLED_UPDATE_REQUIRED','direct settings update is denied');
select throws_ok($$delete from public.clinic_settings_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','settings history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_settings_history'::regclass),'settings history enables and forces RLS');
select ok(not exists(select 1 from public.audit_event where action like 'clinic.settings_%' and metadata::text ~* '(token|cookie|password|patient|request|email)'),'settings audit metadata excludes sensitive data');
select is((select count(*) from public.clinic_settings_history where clinic_id='f2000000-0000-4000-8000-000000000001'),2::bigint,'failed updates create no misleading history');
select is((select changed_fields from public.clinic_settings_history where clinic_id='f2000000-0000-4000-8000-000000000001' and new_revision=2),array['display_name','timezone']::text[],'history stores only changed field identifiers');
select is((select updated_by_platform_user_id from public.clinic where id='f2000000-0000-4000-8000-000000000001'),'f1000000-0000-4000-8000-000000000002'::uuid,'updated_by records the trusted actor');

rollback;
