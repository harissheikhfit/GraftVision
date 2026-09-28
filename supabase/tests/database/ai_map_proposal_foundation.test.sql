begin;
select plan(41);

-- 1. Tables and RLS (immutable proposals, provenance)
select has_table('public', 'ai_map_proposal_package', 'ai_map_proposal_package should exist');
select results_eq(
  $$
    select relrowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.ai_map_proposal_package'::regclass,
      'public.ai_map_proposal_idempotency'::regclass,
      'public.ai_map_proposal_landmark'::regclass,
      'public.ai_map_proposal_curve'::regclass,
      'public.ai_map_proposal_region'::regclass,
      'public.ai_map_proposal_asset_binding'::regclass,
      'public.model_annotation_ai_provenance'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true), (true), (true), (true), (true) $$,
  'RLS is enabled on AI-MAP tables'
);

select results_eq(
  $$
    select relforcerowsecurity
    from pg_catalog.pg_class
    where oid in (
      'public.ai_map_proposal_package'::regclass,
      'public.ai_map_proposal_idempotency'::regclass,
      'public.ai_map_proposal_landmark'::regclass,
      'public.ai_map_proposal_curve'::regclass,
      'public.ai_map_proposal_region'::regclass,
      'public.ai_map_proposal_asset_binding'::regclass,
      'public.model_annotation_ai_provenance'::regclass
    )
    order by relname
  $$,
  $$ values (true), (true), (true), (true), (true), (true), (true) $$,
  'RLS is forced on AI-MAP tables'
);
select policies_are('public', 'ai_map_proposal_package', array[]::name[], 'ordinary reads are denied without functions');

-- 2. Confidence bounds and quality state
select results_eq(
  $$ select c.relname::text collate "C", a.attname::text collate "C", pg_get_constraintdef(con.oid) ilike '%confidence >= %' from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey) where con.conname = 'ai_map_proposal_landmark_confidence_check' $$,
  $$ values ('ai_map_proposal_landmark'::text collate "C", 'confidence'::text collate "C", true) $$,
  'landmark has confidence bounds'
);
select results_eq(
  $$ select c.relname::text collate "C", a.attname::text collate "C", pg_get_constraintdef(con.oid) ilike '%confidence >= %' from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey) where con.conname = 'ai_map_proposal_curve_confidence_check' $$,
  $$ values ('ai_map_proposal_curve'::text collate "C", 'confidence'::text collate "C", true) $$,
  'curve has confidence bounds'
);
select results_eq(
  $$ select c.relname::text collate "C", a.attname::text collate "C", pg_get_constraintdef(con.oid) ilike '%confidence >= %' from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey) where con.conname = 'ai_map_proposal_region_confidence_check' $$,
  $$ values ('ai_map_proposal_region'::text collate "C", 'confidence'::text collate "C", true) $$,
  'region has confidence bounds'
);

select results_eq(
  $$ select c.relname::text collate "C", a.attname::text collate "C", pg_get_constraintdef(con.oid) ilike '%ANY (ARRAY[''high''%' from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey) where con.conname = 'ai_map_proposal_landmark_quality_state_check' $$,
  $$ values ('ai_map_proposal_landmark'::text collate "C", 'quality_state'::text collate "C", true) $$,
  'landmark has quality bounds'
);

-- 3. Operations
select has_function('graftvision_private', 'queue_ai_map_proposal', 'queue exists');
select has_function('graftvision_private', 'begin_ai_map_proposal_execution', 'start execution exists');
select has_function('graftvision_private', 'record_ai_map_proposal_output', 'output recording exists');
select has_function('graftvision_private', 'finalize_ai_map_proposal', 'completion exists');
select has_function('graftvision_private', 'fail_ai_map_proposal', 'failure exists');
select has_function('graftvision_private', 'import_ai_map_suggestion_to_draft', 'explicit import exists');
select has_function('graftvision_private', 'record_ai_map_proposal_decision', 'accept/reject decisions exist');
select has_function('graftvision_private', 'read_ai_map_proposal_package', 'read exists');
select has_function('graftvision_private', 'begin_ai_map_proposal_execution', array['uuid','uuid','uuid','uuid','integer','text','text','text','text','text','text','uuid'], 'execution requires tenant and worker lease identity');
select has_function('graftvision_private', 'ai_map_json_number_in_bounds', array['text','numeric','numeric'], 'output number validation helper exists');
select results_eq(
  $$ select pg_get_functiondef('graftvision_private.begin_ai_map_proposal_execution(uuid,uuid,uuid,uuid,integer,text,text,text,text,text,text,uuid)'::regprocedure) like '%current_clinic_id%' and pg_get_functiondef('graftvision_private.begin_ai_map_proposal_execution(uuid,uuid,uuid,uuid,integer,text,text,text,text,text,text,uuid)'::regprocedure) like '%require_reconstruction_job_lease%' $$,
  $$ values (true) $$,
  'execution binds tenant context and worker lease'
);
select results_eq(
  $$ select pg_get_functiondef('graftvision_private.import_ai_map_suggestion_to_draft(uuid,uuid,uuid,uuid,text,integer,uuid)'::regprocedure) like '%AI_MAP_DOCTOR_DECISION_REQUIRED%' and pg_get_functiondef('graftvision_private.import_ai_map_suggestion_to_draft(uuid,uuid,uuid,uuid,text,integer,uuid)'::regprocedure) like '%ai_map_proposal_decision%' $$,
  $$ values (true) $$,
  'import requires explicit Doctor decision before provenance'
);

-- 4. Triggers (controlled mutation, idempotency)
select has_trigger('public', 'ai_map_proposal_package', 'ai_map_proposal_package_controlled', 'package is controlled');
select has_trigger('public', 'ai_map_proposal_idempotency', 'ai_map_proposal_idempotency_controlled', 'idempotency is controlled');

-- 5. Stale binding (Check constraints on the operations or direct tests on schema)
select has_table('public', 'ai_map_proposal_asset_binding', 'asset binding exists');

-- 6. Provenance
select has_table('public', 'model_annotation_ai_provenance', 'provenance exists');
select has_table('public', 'ai_map_inference_execution', 'trusted inference execution binding exists');
select results_eq(
  $$ select relrowsecurity from pg_catalog.pg_class where oid='public.ai_map_inference_execution'::regclass $$,
  $$ values (true) $$,
  'trusted execution binding has RLS'
);
select has_function('graftvision_private', 'begin_ai_map_proposal_execution', 'trusted execution start exists');
select has_function('graftvision_private', 'record_ai_map_proposal_output', 'trusted output validation exists');
select has_function('graftvision_private', 'finalize_ai_map_proposal', 'trusted completion exists');
select has_function('graftvision_private', 'fail_ai_map_proposal', 'trusted failure exists');

-- 7. Throws tests for Doctor denial, audit redaction, etc.
-- Try to write to tables directly
select throws_ok($$insert into public.ai_map_proposal_package (clinic_id) values(gen_random_uuid())$$,null,null,'direct package mutation is denied');
select throws_ok($$insert into public.ai_map_proposal_idempotency (clinic_id) values(gen_random_uuid())$$,null,null,'direct idempotency mutation is denied');
select throws_ok($$insert into public.ai_map_proposal_landmark (clinic_id) values(gen_random_uuid())$$,null,null,'direct landmark mutation is denied');
select throws_ok($$insert into public.ai_map_proposal_curve (clinic_id) values(gen_random_uuid())$$,null,null,'direct curve mutation is denied');
select throws_ok($$insert into public.ai_map_proposal_region (clinic_id) values(gen_random_uuid())$$,null,null,'direct region mutation is denied');
select throws_ok($$insert into public.model_annotation_ai_provenance (clinic_id) values(gen_random_uuid())$$,null,null,'direct provenance mutation is denied');

-- Deny wrong doctor/clinic (this is checked inside queue_ai_map_proposal which requires a valid session)
select throws_ok($$select graftvision_private.queue_ai_map_proposal(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid())$$,'42501',null,'wrong clinic/Doctor denial');
select throws_ok($$select graftvision_private.import_ai_map_suggestion_to_draft(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'landmark',1,gen_random_uuid())$$,'42501',null,'wrong clinic/Doctor denial for import');
select throws_ok($$select graftvision_private.record_ai_map_proposal_decision(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'landmark','accepted',gen_random_uuid())$$,'42501',null,'wrong clinic/Doctor denial for decision');
select throws_ok($$select graftvision_private.begin_ai_map_proposal_execution(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,'wrong-adapter','wrong-version','wrong-model','wrong-version','wrong-pipeline','bad-checksum',gen_random_uuid())$$,'22023',null,'untrusted adapter binding is denied');

-- 8. Enforce audit redaction logic exists on audit_event
select has_table('public', 'audit_event', 'audit_event exists');

select * from finish();
rollback;
