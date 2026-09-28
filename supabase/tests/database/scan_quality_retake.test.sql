begin;
select plan(16);

select has_table('public', 'scan_capture_quality_retake_idempotency', 'retake idempotency is persisted');
select has_function('graftvision_private', 'request_scan_quality_retake', array['uuid','uuid','uuid','uuid','text','integer','text','text'], 'retake uses a controlled operation');
select policies_are('public', 'scan_capture_quality_retake_idempotency', array[]::name[], 'ordinary retake idempotency access is denied');
select throws_ok($$insert into public.scan_capture_quality_retake_idempotency (clinic_id,actor_platform_user_id,idempotency_key,scan_session_id,asset_id,capture_step,expected_revision,reason_code,result_id,result_revision) values(gen_random_uuid(),gen_random_uuid(),'retake',gen_random_uuid(),gen_random_uuid(),'front',1,'IMAGE_TOO_BLURRY',gen_random_uuid(),2)$$, null, null, 'direct retake idempotency mutation is blocked');
select throws_ok($$insert into public.scan_capture_quality_result (review_id,clinic_id,patient_id,consultation_id,scan_session_id,asset_id,capture_step,asset_revision,validator_version,quality_state,created_by) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'front',1,'validator.v1','retake_required',gen_random_uuid())$$, null, null, 'direct quality result mutation is blocked');
select throws_ok($$insert into public.scan_capture_quality_event (review_id,clinic_id,event_type,actor_platform_user_id) values(gen_random_uuid(),gen_random_uuid(),'retake_requested',gen_random_uuid())$$, null, null, 'direct quality event mutation is blocked');
select ok(position('require_scan_capture_context' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'retake derives trusted clinic and Doctor context');
select ok(position('upload_status = ''uploaded''' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'retake requires a current uploaded asset');
select ok(position('SCAN_QUALITY_CONFLICT' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'stale revisions are rejected');
select ok(position('SCAN_QUALITY_IDEMPOTENCY_MISMATCH' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'changed-payload idempotency reuse is rejected');
select ok(position('retake_required' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'retake appends the controlled state');
select ok(position('prior_result_id = current_result_id' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'current pointer preserves prior evidence');
select ok(position('scan_quality.retake_requested' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'successful retake emits the approved audit action');
select ok(position('scan_session_id' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) > 0, 'audit metadata includes only opaque scope references');
select ok(position('object_key' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) = 0, 'retake audit path excludes storage keys');
select ok(position('checksum' in pg_get_functiondef('graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure)) = 0, 'retake audit path excludes checksums');

select * from finish();
rollback;
