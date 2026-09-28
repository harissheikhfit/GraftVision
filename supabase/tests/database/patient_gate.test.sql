-- PATIENT-007 consolidated Patient Gate policy assertions. Synthetic/schema evidence only.
begin;
select plan(32);

select is((select count(*) from public.role_definition),13::bigint,'Patient Gate preserves thirteen roles');
select is((select count(*) from public.permission_definition),60::bigint,'Patient Gate preserves sixty permissions');
select is((select count(*) from public.permission_definition where permission_id in ('PATIENT-PERM-001','PATIENT-PERM-002')),2::bigint,'approved patient permissions remain exact');
select is((select count(*) from public.role_permission where role_code in ('PLATFORM_OWNER','PLATFORM_ADMIN','PLATFORM_SUPPORT') and permission_id like 'PATIENT-PERM-%'),0::bigint,'Platform and Support roles receive no patient permission');
select ok((select prosecdef from pg_proc where oid='graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure),'patient authority is security definer');
select ok(pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%has_application_session_permission%','patient authority validates the application session');
select ok(pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%''clinic''%','patient authority requires clinic scope');
select ok(pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%PATIENT-PERM-001%','patient authority requires exact RBAC permission');
select ok(pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%is_clinic_ready%','patient authority requires clinic readiness');
select ok(
  pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%doctor_verification%'
  and pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%status = ''verified''%'
  and pg_get_functiondef('graftvision_private.has_patient_root_authority(uuid,uuid)'::regprocedure) like '%expires_at > clock_timestamp()%',
  'patient authority preserves Doctor verification'
);
select ok(pg_get_functiondef('graftvision_private.create_patient_root(uuid,uuid,uuid,text,text)'::regprocedure) like '%has_patient_root_authority%','patient creation uses shared authority');
select ok(pg_get_functiondef('graftvision_private.register_patient(uuid,uuid,uuid,text,date,text,text,text,text)'::regprocedure) like '%has_patient_root_authority%','registration uses shared authority');
select ok(pg_get_functiondef('graftvision_private.search_patients(uuid,uuid,text,text,date,date,text,text,integer)'::regprocedure) like '%has_patient_root_authority%','search uses shared authority');
select ok(pg_get_functiondef('graftvision_private.read_patient_profile(uuid,uuid,uuid,boolean)'::regprocedure) like '%has_patient_root_authority%','profile uses shared authority');
select ok(pg_get_functiondef('graftvision_private.record_patient_privacy_acknowledgement(uuid,uuid,uuid,uuid,text,text,uuid,integer,text,uuid)'::regprocedure) like '%has_patient_root_authority%','privacy acknowledgement uses shared authority');
select ok(pg_get_functiondef('graftvision_private.withdraw_patient_privacy_acknowledgement(uuid,uuid,uuid,integer,text,uuid,text,uuid)'::regprocedure) like '%has_patient_root_authority%','privacy withdrawal uses shared authority');
select ok(pg_get_functiondef('graftvision_private.transition_patient_lifecycle(uuid,uuid,uuid,integer,text,text,uuid)'::regprocedure) like '%has_patient_root_authority%','archive and restore use shared authority');
select ok(pg_get_functiondef('graftvision_private.search_patients_lifecycle(uuid,uuid,text,text,date,date,text,text,integer)'::regprocedure) like '%lifecycle_state = ''current''%','ordinary patient search excludes archived records');
select ok(pg_get_functiondef('graftvision_private.read_patient_profile_lifecycle(uuid,uuid,uuid,boolean,boolean)'::regprocedure) like '%p_include_archived%','archived profile access must be explicit');
select ok(pg_get_functiondef('graftvision_private.is_patient_workflow_available(uuid,uuid)'::regprocedure) like '%lifecycle_state = ''current''%','shared workflow guard denies archived patients');
select has_trigger('public','patient_privacy_acknowledgement','patient_privacy_archive_guard','privacy mutation is blocked for archived patients');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.patient'::regclass),'patient table enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.patient_registration'::regclass),'registration table enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.patient_privacy_acknowledgement'::regclass),'privacy table enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.patient_lifecycle_history'::regclass),'lifecycle history enables and forces RLS');
select has_trigger('public','patient_status_history','patient_status_history_immutable','patient status history is immutable');
select has_trigger('public','patient_registration_history','patient_registration_history_immutable','registration history is immutable');
select has_trigger('public','patient_privacy_acknowledgement_history','patient_privacy_ack_history_immutable','privacy history is immutable');
select has_trigger('public','patient_lifecycle_history','patient_lifecycle_history_immutable','lifecycle history is immutable');
select ok(graftvision_private.is_valid_audit_action('patient.create'),'patient creation audit action remains allowed');
select ok(graftvision_private.is_valid_audit_action('patient.privacy_withdraw'),'patient privacy audit action remains allowed');
select ok(graftvision_private.is_valid_audit_action('patient.archive') and graftvision_private.is_valid_audit_action('patient.restore'),'patient lifecycle audit actions remain allowed');

select * from finish();
rollback;
