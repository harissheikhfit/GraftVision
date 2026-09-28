-- PLATFORM-ADMIN-001 synthetic, rollback-only policy and integration tests.
begin;
select plan(54);

select is((select count(*) from public.role_definition),13::bigint,'role catalogue remains thirteen');
select is((select count(*) from public.permission_definition),60::bigint,'permission catalogue is exactly sixty');
select ok(exists(select 1 from public.role_permission where role_code='PLATFORM_OWNER' and permission_id='ADMIN-PERM-007'),'owner receives exact admin assignment permission');
select ok(not exists(select 1 from public.role_permission where role_code<>'PLATFORM_OWNER' and permission_id='ADMIN-PERM-007'),'new permission is owner-only');

select is(
  graftvision_private.bootstrap_first_platform_owner(
    '91000000-0000-4000-8000-000000000001','haris.sheikh@example.test'
  ),
  '91000000-0000-4000-8000-000000000001'::uuid,
  'first owner bootstrap succeeds'
);
select is(
  graftvision_private.bootstrap_first_platform_owner(
    '91000000-0000-4000-8000-000000000001','haris.sheikh@example.test'
  ),
  '91000000-0000-4000-8000-000000000001'::uuid,
  'same owner bootstrap is idempotent'
);
select throws_ok(
  $$select graftvision_private.bootstrap_first_platform_owner(
    '91000000-0000-4000-8000-000000000002','other.owner@example.test'
  )$$,'42501','PLATFORM_OWNER_ALREADY_EXISTS','different owner is refused'
);
select is((select count(*) from public.platform_user_role where role_code='PLATFORM_OWNER'),1::bigint,'only one initial owner exists');
select is((select count(*) from public.platform_user_role where role_code='PLATFORM_ADMIN'),0::bigint,'no Platform Administrator is assigned initially');
select is((select count(*) from public.platform_admin_history where action='owner_bootstrap'),1::bigint,'bootstrap history is not duplicated');
select is((select count(*) from public.audit_event where reason_code='FIRST_OWNER_BOOTSTRAPPED'),1::bigint,'bootstrap audit is not duplicated');

insert into public.platform_user(id,external_identity_id,status) values
 ('91000000-0000-4000-8000-000000000002','clinic.admin@example.test','active'),
 ('91000000-0000-4000-8000-000000000003','support@example.test','active');
insert into public.platform_user_role(platform_user_id,role_code)
values('91000000-0000-4000-8000-000000000003','PLATFORM_SUPPORT');
insert into public.clinic(id,clinic_code,display_name,status,timezone)
values('92000000-0000-4000-8000-000000000001','face-test','FACE Synthetic Clinic','active','Asia/Karachi');

select graftvision_private.create_application_session(
 '91000000-0000-4000-8000-000000000001','platform',null,
 '93000000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 hour','owner',null
) owner_session \gset
select graftvision_private.create_application_session(
 '91000000-0000-4000-8000-000000000003','platform',null,
 '93000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour','support',null
) support_session \gset

select is(
  (select authority_scope from public.application_session where id=:'owner_session'),
  'platform',
  'bootstrap-only owner receives explicit platform scope'
);
select is(
  (select clinic_id from public.application_session where id=:'owner_session'),
  null::uuid,
  'platform login creates no implicit clinic context'
);
select is(
  (select count(*) from public.clinic_membership where platform_user_id='91000000-0000-4000-8000-000000000001'),
  0::bigint,
  'platform login creates no implicit clinic membership'
);
select ok(
  graftvision_private.validate_application_session(:'owner_session'),
  'platform login session passes current authorization validation'
);
select throws_ok(
  $$select graftvision_private.create_application_session(
    '91000000-0000-4000-8000-000000000001','clinic',
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000004',
    clock_timestamp()+interval '1 hour','forged-clinic',null
  )$$,
  '28000',
  'ACTIVE_CLINIC_ROLE_REQUIRED',
  'bootstrap-only owner cannot forge clinic scope'
);

select is((graftvision_private.read_platform_dashboard(
 :'owner_session','91000000-0000-4000-8000-000000000001'
)->>'totalClinics')::integer,3,'owner sees all-clinic operational total');
select ok((graftvision_private.read_platform_dashboard(
 :'owner_session','91000000-0000-4000-8000-000000000001'
)->'clinics'->0) ?& array['id','clinicCode','displayName','timezone','status','revision','readinessState','readinessRevision','administrators'],'clinic projection is bounded');
select ok(not (graftvision_private.read_platform_dashboard(
 :'owner_session','91000000-0000-4000-8000-000000000001'
))::text ~* '(patient|consultation|scan|report|clinical)','dashboard excludes patient and clinical fields');
select throws_ok(format(
 $sql$select graftvision_private.read_platform_dashboard(%L::uuid,%L::uuid)$sql$,
 :'support_session','91000000-0000-4000-8000-000000000003'
),'42501','AUTH_PERMISSION_DENIED','Support is denied the platform console');

select is(graftvision_private.update_platform_clinic_metadata(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000001','FACE Updated','Asia/Karachi',1
),2,'owner updates bounded clinic metadata');
select throws_ok(format(
 $sql$select graftvision_private.update_platform_clinic_metadata(%L::uuid,%L::uuid,'92000000-0000-4000-8000-000000000001','Stale','Asia/Karachi',1)$sql$,
 :'owner_session','91000000-0000-4000-8000-000000000001'
),'40001','CLINIC_REVISION_CONFLICT','metadata update uses optimistic concurrency');

select graftvision_private.manage_platform_clinic_administrator(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','assign'
) admin_membership \gset
select ok(exists(select 1 from public.clinic_membership_role where clinic_membership_id=:'admin_membership' and role_code='CLINIC_ADMIN'),'Clinic Administrator assignment succeeds');
select ok(not exists(select 1 from public.clinic_membership_role where clinic_membership_id=:'admin_membership' and role_code in ('CLINIC_OWNER','DOCTOR')),'assignment grants no owner or Doctor role');
select ok(not exists(select 1 from public.platform_user_role where platform_user_id='91000000-0000-4000-8000-000000000001' and role_code='PLATFORM_ADMIN'),'Haris owner path does not assign Platform Administrator');
select ok(not exists(select 1 from public.clinic_membership where platform_user_id='91000000-0000-4000-8000-000000000001'),'owner receives no implicit clinic membership');

select graftvision_private.manage_platform_clinic_administrator(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','remove'
);
select ok(not exists(select 1 from public.clinic_membership_role where clinic_membership_id=:'admin_membership' and role_code='CLINIC_ADMIN'),'Clinic Administrator removal succeeds');
select throws_ok($$update public.platform_admin_history set reason_code='CHANGED'$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','administrative history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.platform_admin_history'::regclass),'administrative history forces RLS');
select is((select count(*) from public.audit_event where action='platform.admin' and metadata::text ~* '(password|token|cookie|patient)'),0::bigint,'platform audit metadata excludes sensitive content');
select is((select count(*) from public.role_permission where permission_id like 'PATIENT-PERM-%' and role_code='PLATFORM_OWNER'),0::bigint,'Platform Owner receives no patient permission');
select is((select count(*) from public.role_permission where role_code='PLATFORM_SUPPORT' and permission_id='ADMIN-PERM-007'),0::bigint,'Support receives no administrative assignment authority');
select ok((select prosecdef from pg_proc where oid='graftvision_private.read_platform_dashboard(uuid,uuid)'::regprocedure),'platform projection is database-authoritative');

insert into public.platform_user_role(platform_user_id,role_code)
values('91000000-0000-4000-8000-000000000002','PLATFORM_OWNER');
select graftvision_private.create_application_session(
 '91000000-0000-4000-8000-000000000002','platform',null,
 '93000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 hour','second-owner',null
) second_owner_session \gset

select ok(graftvision_private.manage_platform_user_lifecycle(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000002','deactivate','ACCESS_REVIEW',
 (select authorization_version from public.platform_user where id='91000000-0000-4000-8000-000000000002')
)>0,'a second active owner may be deactivated');
select is((select status from public.platform_user where id='91000000-0000-4000-8000-000000000002'),'suspended','deactivation changes account eligibility');
select ok((select revoked_at is not null from public.application_session where id=:'second_owner_session'),'deactivation revokes the target platform session');
select throws_ok(format(
 $sql$select graftvision_private.manage_platform_user_lifecycle(%L::uuid,'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','deactivate','ACCESS_REVIEW',(select authorization_version from public.platform_user where id='91000000-0000-4000-8000-000000000001'))$sql$,
 :'owner_session'
),'42501','FINAL_PLATFORM_OWNER_PROTECTED','the final active owner cannot self-deactivate');
select ok(graftvision_private.manage_platform_user_lifecycle(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000002','reactivate','ACCOUNT_RESTORED',
 (select authorization_version from public.platform_user where id='91000000-0000-4000-8000-000000000002')
)>0,'an inactive platform user may be reactivated');
select ok((select revoked_at is not null from public.application_session where id=:'second_owner_session'),'reactivation does not restore revoked sessions');
select ok(exists(select 1 from public.platform_user_role where platform_user_id='91000000-0000-4000-8000-000000000002' and role_code='PLATFORM_OWNER'),'reactivation does not recreate or remove role assignments');
select throws_ok(format(
 $sql$select graftvision_private.manage_platform_user_lifecycle(%L::uuid,'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','reactivate','ACCOUNT_RESTORED',(select authorization_version from public.platform_user where id='91000000-0000-4000-8000-000000000002'))$sql$,
 :'owner_session'
),'40001','PLATFORM_USER_ALREADY_ACTIVE','repeated reactivation is a controlled conflict');

select graftvision_private.create_application_session(
 '91000000-0000-4000-8000-000000000002','platform',null,
 '93000000-0000-4000-8000-000000000004',clock_timestamp()+interval '1 hour','new-session',null
) revocable_session \gset
select is(graftvision_private.revoke_platform_user_sessions(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000002',:'revocable_session',false,'SECURITY_RESPONSE'
),1,'one selected platform session is revoked');
select is(graftvision_private.revoke_platform_user_sessions(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000002',:'revocable_session',false,'SECURITY_RESPONSE'
),0,'already-revoked replay is idempotent');
select ok((select revoked_at is null from public.application_session where id=:'owner_session'),'unrelated owner session is preserved');
select is(graftvision_private.revoke_platform_user_sessions(
 :'owner_session','91000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000002',null,true,'ACCESS_REVIEW'
),0,'revoke-all safely reports no remaining active sessions');
select throws_ok(format(
 $sql$select graftvision_private.revoke_platform_user_sessions(%L::uuid,'91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002',null,true,'ACCESS_REVIEW')$sql$,
 :'support_session'
),'42501','AUTH_PERMISSION_DENIED','Support cannot revoke platform sessions');

select ok((graftvision_private.read_platform_session_health(
 :'owner_session','91000000-0000-4000-8000-000000000001',null,null,25
)) ?& array['activeCount','staleCount','revokedCount','expiredCount','lockedCount','users','sessions'],'session-health summary is bounded');
select ok(not (graftvision_private.read_platform_session_health(
 :'owner_session','91000000-0000-4000-8000-000000000001',null,null,25
))::text ~* '(token|cookie|password|user.agent|ip.address|patient|clinical)','session-health projection excludes sensitive fields');
select throws_ok(format(
 $sql$select graftvision_private.read_platform_session_health(%L::uuid,'91000000-0000-4000-8000-000000000003',null,null,25)$sql$,
 :'support_session'
),'42501','AUTH_PERMISSION_DENIED','Support cannot read session health');
select lives_ok(format(
 $sql$select * from graftvision_private.read_filtered_platform_audit(%L::uuid,'91000000-0000-4000-8000-000000000001',null,null,null,null,'user.deactivate',null,25)$sql$,
 :'owner_session'
),'controlled audit filtering succeeds');
select ok(exists(select 1 from public.audit_event where reason_code='PLATFORM_AUDIT_VIEWED'),'audit viewing creates controlled evidence');
select is((select count(*) from public.audit_event where metadata::text ~* '(password|token|cookie|patient|clinical)'),0::bigint,'operational audit evidence is redacted');
select throws_ok($$update public.platform_operational_history set reason_code='ACCESS_REVIEW'$$,'55000','CLINIC_STATUS_HISTORY_IMMUTABLE','operational history is immutable');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.platform_operational_history'::regclass),'operational history forces RLS');

select * from finish();
rollback;
