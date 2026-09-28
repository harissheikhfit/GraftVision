-- CLINIC-004 clinic staff-management tests.
-- Synthetic fixtures only; all changes are rolled back.

begin;
select plan(48);

insert into public.clinic (id, clinic_code, display_name, status) values
  ('e2000000-0000-4000-8000-000000000001', 'staff-a', 'Staff Clinic A', 'active'),
  ('e2000000-0000-4000-8000-000000000002', 'staff-b', 'Staff Clinic B', 'active');

insert into public.platform_user (id, external_identity_id, status) values
  ('e1000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000001', 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000002', 'active'),
  ('e1000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000003', 'active'),
  ('e1000000-0000-4000-8000-000000000004', 'e9000000-0000-4000-8000-000000000004', 'active'),
  ('e1000000-0000-4000-8000-000000000005', 'e9000000-0000-4000-8000-000000000005', 'active'),
  ('e1000000-0000-4000-8000-000000000006', 'e9000000-0000-4000-8000-000000000006', 'active');

insert into public.platform_user_role (platform_user_id, role_code) values
  ('e1000000-0000-4000-8000-000000000005', 'PLATFORM_OWNER'),
  ('e1000000-0000-4000-8000-000000000006', 'PLATFORM_SUPPORT');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'active'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'active'),
  ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 'active'),
  ('e3000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000004', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('e3000000-0000-4000-8000-000000000001', 'CLINIC_OWNER'),
  ('e3000000-0000-4000-8000-000000000002', 'CLINIC_ADMIN'),
  ('e3000000-0000-4000-8000-000000000003', 'CLINICAL_ASSISTANT'),
  ('e3000000-0000-4000-8000-000000000004', 'CLINIC_OWNER');

select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000001', 'clinic', 'e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001', clock_timestamp() + interval '1 hour', 'owner-a', null
) owner_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000002', 'clinic', 'e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000002', clock_timestamp() + interval '1 hour', 'admin-a', null
) admin_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000003', 'clinic', 'e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000003', clock_timestamp() + interval '1 hour', 'staff-a', null
) staff_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000004', 'clinic', 'e2000000-0000-4000-8000-000000000002',
  'e4000000-0000-4000-8000-000000000004', clock_timestamp() + interval '1 hour', 'owner-b', null
) owner_b_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000005', 'platform', null,
  'e4000000-0000-4000-8000-000000000005', clock_timestamp() + interval '1 hour', 'platform-owner', null
) platform_session \gset
select graftvision_private.create_application_session(
  'e1000000-0000-4000-8000-000000000006', 'platform', null,
  'e4000000-0000-4000-8000-000000000006', clock_timestamp() + interval '1 hour', 'support', null
) support_session \gset

select is((select count(*) from public.role_definition), 13::bigint, 'role catalogue remains exactly thirteen roles');
select is((select count(*) from public.permission_definition), 60::bigint, 'permission catalogue remains exactly sixty permissions');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_OWNER' and permission_id='ADMIN-PERM-003'), 'Clinic Owner has ADMIN-PERM-003');
select ok(exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='ROLE-006'), 'Clinic Administrator has ROLE-006');
select ok(not exists(select 1 from public.role_permission where role_code='CLINIC_ADMIN' and permission_id='ROLE-007'), 'Clinic Administrator lacks ROLE-007');

select graftvision_private.create_clinic_invitation(
  :'admin_session', 'e1000000-0000-4000-8000-000000000002',
  'staff@example.test', repeat('a',64), array['CLINICAL_ASSISTANT'], 7
) admin_invitation \gset
select ok(:'admin_invitation'::uuid is not null, 'Clinic Administrator invites an ordinary staff role');
select is((select normalized_email from public.clinic_invitation where id=:'admin_invitation'), 'staff@example.test', 'email is normalized and clinic scoped');
select is((select expires_at::date - created_at::date from public.clinic_invitation where id=:'admin_invitation'), 7, 'pilot invitation expiry is seven days');

select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'staff@example.test',repeat('b',64),array['RECEPTION'],7)$sql$, :'admin_session','e1000000-0000-4000-8000-000000000002'),
  '23505','PENDING_INVITATION_EXISTS','duplicate pending invitation is rejected'
);
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'doctor@example.test',repeat('c',64),array['DOCTOR'],7)$sql$, :'admin_session','e1000000-0000-4000-8000-000000000002'),
  '42501','ROLE_ASSIGNMENT_DENIED','Clinic Administrator cannot invite Doctor'
);
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'patient@example.test',repeat('d',64),array['PATIENT'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','ROLE_ASSIGNMENT_DENIED','Patient role invitation is denied'
);

select graftvision_private.create_clinic_invitation(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  'doctor@example.test',repeat('e',64),array['DOCTOR'],7
) doctor_invitation \gset
select ok(:'doctor_invitation'::uuid is not null, 'Clinic Owner may invite Doctor');

select graftvision_private.transition_clinic_invitation(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  :'doctor_invitation','resend',repeat('f',64)
);
select is((select count(*) from public.clinic_invitation_history where invitation_id=:'doctor_invitation'),2::bigint,'resend appends immutable history');
select throws_ok(
  format($sql$select graftvision_private.accept_clinic_invitation(%L::uuid,%L::uuid,'doctor@example.test',repeat('e',64))$sql$, :'doctor_invitation','e1000000-0000-4000-8000-000000000006'),
  '42501','INVITATION_NOT_AVAILABLE','old invitation reference is invalid after resend'
);

select graftvision_private.accept_clinic_invitation(
  :'doctor_invitation','e1000000-0000-4000-8000-000000000006',
  'doctor@example.test',repeat('f',64)
) doctor_membership \gset
select is(
  graftvision_private.accept_clinic_invitation(
    :'doctor_invitation','e1000000-0000-4000-8000-000000000006',
    'doctor@example.test',repeat('f',64)
  ),
  :'doctor_membership'::uuid,
  'invitation acceptance is replay-safe and idempotent'
);
select ok(exists(select 1 from public.clinic_membership_role where clinic_membership_id=:'doctor_membership' and role_code='DOCTOR'),'acceptance assigns the invited Doctor role');
select is(graftvision_private.has_doctor_authority(
  graftvision_private.create_application_session(
    'e1000000-0000-4000-8000-000000000006','clinic','e2000000-0000-4000-8000-000000000001',
    'e4000000-0000-4000-8000-000000000007',clock_timestamp()+interval '1 hour','doctor-no-verification',null
  ),'ROLE-001'
),false,'Doctor role without verification grants no Doctor authority');

select graftvision_private.create_clinic_invitation(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  'revoke@example.test',repeat('1',64),array['RECEPTION'],7
) revoke_invitation \gset
select graftvision_private.transition_clinic_invitation(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  :'revoke_invitation','revoke',null
);
select is((select status from public.clinic_invitation where id=:'revoke_invitation'),'revoked','pending invitation may be revoked');
select throws_ok(
  format($sql$select graftvision_private.transition_clinic_invitation(%L::uuid,%L::uuid,%L::uuid,'resend',repeat('2',64))$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001',:'revoke_invitation'),
  '22023','INVITATION_NOT_PENDING','revoked invitation cannot be resent'
);
select throws_ok(
  format($sql$select graftvision_private.transition_clinic_invitation(%L::uuid,%L::uuid,%L::uuid,'revoke',null)$sql$, :'owner_b_session','e1000000-0000-4000-8000-000000000004',:'admin_invitation'),
  '42501','INVITATION_NOT_AVAILABLE','Clinic B cannot discover or mutate Clinic A invitation'
);
select is(
  (select count(*) from graftvision_private.list_clinic_staff(
    :'owner_b_session','e1000000-0000-4000-8000-000000000004'
  )),
  1::bigint,
  'Clinic B staff listing contains only Clinic B memberships'
);
select is(
  (select count(*) from graftvision_private.list_pending_clinic_invitations(
    :'owner_b_session','e1000000-0000-4000-8000-000000000004'
  )),
  0::bigint,
  'Clinic B pending invitation listing does not enumerate Clinic A'
);
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'platform@example.test',repeat('3',64),array['RECEPTION'],7)$sql$, :'platform_session','e1000000-0000-4000-8000-000000000005'),
  '42501','AUTH_PERMISSION_DENIED','platform role cannot use clinic staff flow'
);
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'support@example.test',repeat('4',64),array['RECEPTION'],7)$sql$, :'support_session','e1000000-0000-4000-8000-000000000006'),
  '42501','AUTH_PERMISSION_DENIED','Support Engineer cannot use clinic staff flow'
);

select is((select authorization_version from public.clinic_membership where id='e3000000-0000-4000-8000-000000000003'),2,'role fixture starts at expected authorization version');
select graftvision_private.set_clinic_membership_roles(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000003',array['RECEPTION']
);
select is((select authorization_version from public.clinic_membership where id='e3000000-0000-4000-8000-000000000003'),3,'role change increments authorization version exactly once');
select is(graftvision_private.validate_application_session(:'staff_session'),false,'role change invalidates the affected old session');
select is(graftvision_private.validate_application_session(:'owner_b_session'),true,'role change preserves unrelated clinic sessions');

select throws_ok(
  format($sql$select graftvision_private.set_clinic_membership_roles(%L::uuid,%L::uuid,%L::uuid,array['DOCTOR'])$sql$, :'admin_session','e1000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000003'),
  '42501','ROLE_ASSIGNMENT_DENIED','Clinic Administrator cannot assign restricted role'
);
select is((select authorization_version from public.clinic_membership where id='e3000000-0000-4000-8000-000000000003'),3,'failed role change rolls back without version mutation');
select is(
  (select count(*) from public.clinic_staff_management_history
    where clinic_membership_id='e3000000-0000-4000-8000-000000000003'),
  1::bigint,
  'failed role change rolls back without history or audit evidence'
);

select graftvision_private.deactivate_clinic_staff(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000003'
);
select is((select membership_status from public.clinic_membership where id='e3000000-0000-4000-8000-000000000003'),'suspended','staff membership is deactivated');
select is((select authorization_version from public.clinic_membership where id='e3000000-0000-4000-8000-000000000003'),4,'deactivation increments authorization version exactly once');

select graftvision_private.create_clinic_invitation(
  :'owner_session','e1000000-0000-4000-8000-000000000001',
  'expired@example.test',repeat('5',64),array['RECEPTION'],7
) expired_invitation \gset
select set_config('graftvision.staff_management_controlled','on',true);
update public.clinic_invitation set expires_at=clock_timestamp()-interval '1 second'
where id=:'expired_invitation';
select set_config('graftvision.staff_management_controlled','off',true);
select throws_ok(
  format($sql$select graftvision_private.transition_clinic_invitation(%L::uuid,%L::uuid,%L::uuid,'resend',repeat('6',64))$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001',:'expired_invitation'),
  '22023','INVITATION_NOT_PENDING','expired invitation cannot be resent'
);

update public.application_session
set locked_at=clock_timestamp(), lock_reason_code='MANUAL'
where id=:'owner_session';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'locked@example.test',repeat('7',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','locked session cannot manage clinic staff'
);
update public.application_session set locked_at=null, lock_reason_code=null where id=:'owner_session';

update public.application_session
set revoked_at=clock_timestamp(), revoke_reason_code='REVOKE_ONE'
where id=:'owner_session';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'revoked@example.test',repeat('8',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','revoked session cannot manage clinic staff'
);
update public.application_session set revoked_at=null, revoke_reason_code=null where id=:'owner_session';

update public.application_session set absolute_expires_at=clock_timestamp()-interval '1 second'
where id=:'owner_session';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'expired-session@example.test',repeat('9',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','expired session cannot manage clinic staff'
);
update public.application_session set absolute_expires_at=clock_timestamp()+interval '1 hour'
where id=:'owner_session';

update public.platform_user set status='suspended'
where id='e1000000-0000-4000-8000-000000000001';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'inactive-user@example.test',repeat('a',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','inactive platform user cannot manage clinic staff'
);
update public.platform_user set status='active'
where id='e1000000-0000-4000-8000-000000000001';

update public.clinic set status='suspended'
where id='e2000000-0000-4000-8000-000000000001';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'inactive-clinic@example.test',repeat('b',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','inactive clinic cannot manage clinic staff'
);
update public.clinic set status='active'
where id='e2000000-0000-4000-8000-000000000001';

update public.clinic_membership set membership_status='suspended'
where id='e3000000-0000-4000-8000-000000000001';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'inactive-membership@example.test',repeat('c',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','inactive membership cannot manage clinic staff'
);
update public.clinic_membership set membership_status='active'
where id='e3000000-0000-4000-8000-000000000001';

update public.clinic_membership
set authorization_version=authorization_version+1
where id='e3000000-0000-4000-8000-000000000001';
select throws_ok(
  format($sql$select graftvision_private.create_clinic_invitation(%L::uuid,%L::uuid,'stale@example.test',repeat('d',64),array['RECEPTION'],7)$sql$, :'owner_session','e1000000-0000-4000-8000-000000000001'),
  '42501','AUTH_PERMISSION_DENIED','stale session cannot manage clinic staff'
);

select throws_ok(
  $$insert into public.clinic_invitation (
      clinic_id, normalized_email, provider_reference_hash, expires_at,
      created_by_platform_user_id
    ) values (
      'e2000000-0000-4000-8000-000000000001','direct@example.test',repeat('e',64),
      clock_timestamp()+interval '7 days','e1000000-0000-4000-8000-000000000001'
    )$$,
  '55000','INVITATION_CONTROLLED_MUTATION_REQUIRED','direct invitation mutation is denied'
);
select throws_ok(
  $$update public.clinic_invitation_history set action='revoked' where invitation_id=(select id from public.clinic_invitation limit 1)$$,
  '55000','CLINIC_STAFF_HISTORY_IMMUTABLE','invitation history is immutable'
);
select throws_ok(
  $$delete from public.clinic_staff_management_history$$,
  '55000','CLINIC_STAFF_HISTORY_IMMUTABLE','staff-management history is immutable'
);
select ok(not exists(
  select 1 from public.audit_event
  where action like 'invitation.%'
    and metadata::text ~* '(email|token|otp|password|cookie|request|user.agent)'
),'audit metadata excludes invitation secrets and email');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_invitation'::regclass),'invitation state enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_invitation_history'::regclass),'invitation history enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.clinic_staff_management_history'::regclass),'staff-management history enables and forces RLS');

rollback;
