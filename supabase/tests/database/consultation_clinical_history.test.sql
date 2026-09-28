-- CONSULT-003 structural and policy coverage. Synthetic data only.
begin;
select plan(25);

select has_table('public', 'patient_medical_history', 'medical-history root exists');
select has_table('public', 'patient_medical_history_version', 'immutable medical versions exist');
select has_table('public', 'consultation_hair_loss_history', 'hair-loss root exists');
select has_table('public', 'consultation_hair_loss_history_version', 'immutable hair versions exist');
select has_table('public', 'consultation_history_binding', 'exact version binding exists');
select has_table('public', 'clinical_history_change_event', 'material change evidence exists');
select has_table('public', 'clinical_history_review_event', 'review history exists');
select has_table('public', 'doctor_private_note', 'private-note root exists');
select has_table('public', 'doctor_private_note_version', 'private-note versions exist');
select has_table('public', 'clinical_operation_idempotency', 'clinical idempotency exists');

select ok(relrowsecurity and relforcerowsecurity, 'medical root has forced RLS')
from pg_class where oid = 'public.patient_medical_history'::regclass;
select ok(relrowsecurity and relforcerowsecurity, 'medical versions have forced RLS')
from pg_class where oid = 'public.patient_medical_history_version'::regclass;
select ok(relrowsecurity and relforcerowsecurity, 'hair root has forced RLS')
from pg_class where oid = 'public.consultation_hair_loss_history'::regclass;
select ok(relrowsecurity and relforcerowsecurity, 'hair versions have forced RLS')
from pg_class where oid = 'public.consultation_hair_loss_history_version'::regclass;
select ok(relrowsecurity and relforcerowsecurity, 'private notes have forced RLS')
from pg_class where oid = 'public.doctor_private_note'::regclass;

select has_function(
  'graftvision_private', 'save_patient_medical_history',
  array['uuid','uuid','uuid','integer','uuid','text','text','text','text','text','text',
        'text','text','text','text','text','text','text[]','text'],
  'controlled medical-history save exists'
);
select has_function(
  'graftvision_private', 'save_consultation_hair_loss_history',
  array['uuid','uuid','uuid','integer','uuid','text','text','integer','text','text',
        'text','text','text[]','text[]','text','text','text'],
  'controlled hair-loss save exists'
);
select has_function(
  'graftvision_private', 'transition_clinical_history_review',
  array['uuid','uuid','uuid','text','integer','text','text','uuid'],
  'controlled review transition exists'
);
select has_function(
  'graftvision_private', 'mutate_doctor_private_note',
  array['uuid','uuid','uuid','uuid','integer','text','text','text','uuid'],
  'controlled private-note mutation exists'
);
select has_function(
  'graftvision_private', 'read_consultation_clinical_history',
  array['uuid','uuid','uuid'],
  'readiness projection exists'
);

select is(
  (select count(*)::integer from public.role_definition),
  13, 'existing 13-role catalogue is unchanged'
);
select is(
  (select count(*)::integer from public.permission_definition),
  60, 'existing permission catalogue is unchanged'
);
select ok(
  graftvision_private.is_valid_audit_action('doctor_private_note.sensitive_read'),
  'sensitive private-note read is audit allowlisted'
);
select ok(
  not graftvision_private.is_valid_audit_metadata(
    jsonb_build_object('note_text', 'prohibited synthetic narrative')
  ),
  'private-note text is rejected from audit metadata'
);
select has_trigger(
  'public',
  'doctor_private_note_version',
  'private_note_version_immutable',
  'private-note history has an immutable mutation guard'
);

select * from finish();
rollback;
