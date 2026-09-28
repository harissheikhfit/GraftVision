-- CLINIC-003 bounded branding, tenant authority, concurrency, history, and storage tests.
begin;
select plan(38);

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('e2000000-0000-4000-8000-000000000001','brand-a','Brand Clinic A','active','Asia/Karachi'),
  ('e2000000-0000-4000-8000-000000000002','brand-b','Brand Clinic B','active','Asia/Karachi');

insert into public.platform_user (id, external_identity_id, status) values
  ('e1000000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001','active'),
  ('e1000000-0000-4000-8000-000000000002','e9000000-0000-4000-8000-000000000002','active'),
  ('e1000000-0000-4000-8000-000000000003','e9000000-0000-4000-8000-000000000003','active'),
  ('e1000000-0000-4000-8000-000000000004','e9000000-0000-4000-8000-000000000004','active'),
  ('e1000000-0000-4000-8000-000000000005','e9000000-0000-4000-8000-000000000005','active');
insert into public.platform_user_role (platform_user_id, role_code) values
  ('e1000000-0000-4000-8000-000000000004','PLATFORM_OWNER'),
  ('e1000000-0000-4000-8000-000000000005','PLATFORM_SUPPORT');
insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','active'),
  ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','active'),
  ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','active');
insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('e3000000-0000-4000-8000-000000000001','CLINIC_OWNER'),
  ('e3000000-0000-4000-8000-000000000002','CLINIC_ADMIN'),
  ('e3000000-0000-4000-8000-000000000003','CLINICAL_ASSISTANT');

select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000001','clinic','e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','owner',null
) owner_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000002','clinic','e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','admin',null
) admin_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000003','clinic','e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','assistant',null
) assistant_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000004','platform',null,
  'e4000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','platform',null
) platform_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000005','platform',null,
  'e4000000-0000-4000-8000-000000000005',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue remains sixty');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_OWNER' and permission_id='ADMIN-PERM-001'),'Owner has branding permission');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='ADMIN-PERM-001'),'Administrator has branding permission');
select ok((select not public and file_size_limit=2097152 from storage.buckets where id='clinic-branding-private'),'logo bucket is private and bounded');
select is((select clinic_name from graftvision_private.read_clinic_branding(:'owner_session','e1000000-0000-4000-8000-000000000001')),'Brand Clinic A','Owner reads same-clinic branding');
select is(graftvision_private.update_clinic_branding(
  :'owner_session','e1000000-0000-4000-8000-000000000001',1,
  'Brand Clinic A','Updated Report','Updated Presentation',
  '#14532d','#0f766e','#155e75','#166534','replace',
  'clinics/e2000000-0000-4000-8000-000000000001/clinic-assets/clinic-branding/clinic-logo/e5000000-0000-4000-8000-000000000001/v0002/original.png',
  'image/png',512,512,'BRANDING_UPDATED'
),'updated','valid branding and logo update succeeds');
select is((select branding_revision from public.clinic_branding where clinic_id='e2000000-0000-4000-8000-000000000001'),2,'branding revision increments exactly once');
select is((select count(*) from public.clinic_branding_history where clinic_id='e2000000-0000-4000-8000-000000000001'),1::bigint,'success appends immutable history');
select is((select count(*) from public.audit_event where action='clinic.branding_update' and clinic_id='e2000000-0000-4000-8000-000000000001'),1::bigint,'success writes controlled audit');
select is(graftvision_private.update_clinic_branding(
  :'owner_session','e1000000-0000-4000-8000-000000000001',1,
  'Brand Clinic A','Stale Report','Stale Presentation',
  '#14532d','#0f766e','#155e75','#166534','keep',null,null,null,null,'BRANDING_UPDATED'
),'conflict','stale revision returns safe conflict');
select is((select branding_revision from public.clinic_branding where clinic_id='e2000000-0000-4000-8000-000000000001'),2,'conflict does not overwrite');
select is((select count(*) from public.audit_event where action='clinic.branding_conflict'),1::bigint,'conflict records denied audit');
select is(graftvision_private.update_clinic_branding(
  :'admin_session','e1000000-0000-4000-8000-000000000002',2,
  'Brand Clinic A','Updated Report','Updated Presentation',
  '#14532d','#0f766e','#155e75','#166534','remove',null,null,null,null,'LOGO_REMOVED'
),'updated','Clinic Administrator may update and remove logo');
select is((select logo_object_key from public.clinic_branding where clinic_id='e2000000-0000-4000-8000-000000000001'),null,'logo removal restores default identity');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'assistant_session','e1000000-0000-4000-8000-000000000003'),'42501','AUTH_PERMISSION_DENIED','other clinic role is denied');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'platform_session','e1000000-0000-4000-8000-000000000004'),'42501','AUTH_PERMISSION_DENIED','Platform role is denied ordinary branding');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'support_session','e1000000-0000-4000-8000-000000000005'),'42501','AUTH_PERMISSION_DENIED','Support Engineer is denied ordinary branding');
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000002'),'42501','AUTH_PERMISSION_DENIED','forged provider context is denied');
select is((select count(*) from graftvision_private.read_clinic_branding(:'owner_session','e1000000-0000-4000-8000-000000000001') where clinic_id='e2000000-0000-4000-8000-000000000002'),0::bigint,'Clinic A cannot read Clinic B branding');
select throws_ok($$update public.clinic_branding set primary_accent='#000000' where clinic_id='e2000000-0000-4000-8000-000000000001'$$,'55000','CLINIC_BRANDING_CONTROLLED_UPDATE_REQUIRED','direct branding mutation is denied');
select throws_ok($$delete from public.clinic_branding_history$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','branding history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_branding'::regclass),'branding state enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_branding_history'::regclass),'branding history enables and forces RLS');
select throws_ok(format($sql$select graftvision_private.update_clinic_branding(%L::uuid,%L::uuid,3,'Brand Clinic A','Report','Presentation','#dddddd','#0f766e','#155e75','#166534','keep',null,null,null,null,'BRANDING_UPDATED')$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'22023','INVALID_BRANDING_ACCENT','unsafe contrast is rejected');
select throws_ok(format($sql$select graftvision_private.update_clinic_branding(%L::uuid,%L::uuid,3,'Brand Clinic A','Report','Presentation','var(--gv-color-error)','#0f766e','#155e75','#166534','keep',null,null,null,null,'BRANDING_UPDATED')$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'22023','INVALID_BRANDING_ACCENT','semantic token override is rejected');
select throws_ok(format($sql$select graftvision_private.update_clinic_branding(%L::uuid,%L::uuid,3,'Brand Clinic A','Report','Presentation','#14532d','#0f766e','#155e75','#166534','replace','clinics/e2000000-0000-4000-8000-000000000002/clinic-assets/clinic-branding/clinic-logo/e5000000-0000-4000-8000-000000000001/v0003/original.png','image/png',512,512,'BRANDING_UPDATED')$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'22023','INVALID_BRANDING_LOGO','wrong-clinic logo reference is denied');
select throws_ok(format($sql$select graftvision_private.update_clinic_branding(%L::uuid,%L::uuid,3,'Brand Clinic A','Report','Presentation','#14532d','#0f766e','#155e75','#166534','replace','clinics/e2000000-0000-4000-8000-000000000001/clinic-assets/clinic-branding/clinic-logo/e5000000-0000-4000-8000-000000000001/v0003/original.png','image/png',128,512,'BRANDING_UPDATED')$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'22023','INVALID_BRANDING_LOGO','invalid logo dimensions are rejected');
update public.application_session set locked_at=clock_timestamp(),lock_reason_code='MANUAL' where id=:'owner_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','locked session is denied');
update public.application_session set locked_at=null,lock_reason_code=null,revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ONE' where id=:'owner_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','revoked session is denied');
update public.application_session set revoked_at=null,revoke_reason_code=null,absolute_expires_at=clock_timestamp()-interval '1 second' where id=:'owner_session';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','expired session is denied');
update public.application_session set absolute_expires_at=clock_timestamp()+interval '1 hour' where id=:'owner_session';
update public.platform_user set status='suspended' where id='e1000000-0000-4000-8000-000000000001';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','inactive user is denied');
update public.platform_user set status='active' where id='e1000000-0000-4000-8000-000000000001';
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='suspended' where id='e2000000-0000-4000-8000-000000000001';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','suspended clinic is denied');
select set_config('graftvision.clinic_lifecycle_controlled','on',true);
update public.clinic set status='active' where id='e2000000-0000-4000-8000-000000000001';
select set_config('graftvision.clinic_lifecycle_controlled','off',true);
update public.clinic_membership set authorization_version=authorization_version+1 where id='e3000000-0000-4000-8000-000000000001';
select throws_ok(format($sql$select * from graftvision_private.read_clinic_branding(%L::uuid,%L::uuid)$sql$,:'owner_session','e1000000-0000-4000-8000-000000000001'),'42501','AUTH_PERMISSION_DENIED','stale session is denied');
select ok(not exists(select 1 from public.audit_event where action like 'clinic.branding_%' and metadata::text ~* '(token|cookie|password|patient|request|url|image|byte)'),'branding audit metadata excludes sensitive content');
select is((select count(*) from storage.objects where bucket_id='clinic-branding-private'),0::bigint,'database stores no raw logo bytes');
select is((select count(*) from public.clinic_branding_history where clinic_id='e2000000-0000-4000-8000-000000000001'),2::bigint,'failed operations create no misleading history');
select is((select changed_fields from public.clinic_branding_history where clinic_id='e2000000-0000-4000-8000-000000000001' and new_revision=3),array['logo_removed']::text[],'removal history stores only bounded field identifiers');

rollback;
