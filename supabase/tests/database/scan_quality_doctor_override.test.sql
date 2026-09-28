begin;
select plan(30);

select has_table('public', 'scan_capture_quality_override_idempotency', 'override idempotency is persisted');
select has_function('graftvision_private', 'override_scan_quality_result', array['uuid','uuid','uuid','uuid','text','integer','text','uuid'], 'override uses a controlled database operation');
select policies_are('public', 'scan_capture_quality_override_idempotency', array[]::name[], 'ordinary override idempotency access is denied');
select throws_ok($$insert into public.scan_capture_quality_override_idempotency (clinic_id,actor_platform_user_id,idempotency_key,scan_session_id,asset_id,capture_step,expected_revision,override_reason_code,result_id,result_revision) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'front',1,'ACCEPTABLE_FOR_TECHNICAL_REVIEW',gen_random_uuid(),2)$$, null, null, 'direct override idempotency mutation is blocked');
select throws_ok($$insert into public.scan_capture_quality_event (review_id,clinic_id,event_type,actor_platform_user_id) values(gen_random_uuid(),gen_random_uuid(),'doctor_overridden',gen_random_uuid())$$, null, null, 'direct quality event mutation is blocked');

select ok(position('require_scan_capture_context' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'override derives trusted same-clinic session context');
select ok(position('is_assigned_verified_doctor' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'exact assigned verified Doctor is required');
select ok(position('CONSULT-PERM-001' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'Doctor consultation authority remains required');
select ok(position('upload_status = ''uploaded''' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'override requires a current uploaded asset');
select ok(position('v_review.patient_id <> v_asset.patient_id' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'patient binding is verified');
select ok(position('v_review.consultation_id <> v_asset.consultation_id' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'consultation binding is verified');
select ok(position('SCAN_QUALITY_CONFLICT' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'stale revisions are rejected');
select ok(position('SCAN_QUALITY_IDEMPOTENCY_MISMATCH' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'changed-payload idempotency reuse is rejected');
select ok(position('v_existing.result_id' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'idempotent replay returns the original result');
select ok(position('quality_state not in (''warning'', ''retake_required'')' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'only warning and retake-required states are overridable');
select ok(position('IMAGE_TOO_SMALL' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'too-small structural failures remain non-overridable');
select ok(position('INVALID_ORIENTATION' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'orientation structural failures remain non-overridable');
select ok(position('DUPLICATE_ANGLE_IMAGE' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'duplicate-angle structural failures remain non-overridable');
select ok(position('ANGLE_MISMATCH' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'angle-mismatch structural failures remain non-overridable');
select ok(position('ASSET_REPLACED' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'replaced-asset failures remain non-overridable');
select ok(position('doctor_overridden' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'override appends the controlled quality state');
select ok(position('prior_result_id = current_result_id' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'override preserves immutable prior evidence');
select ok(position('revision = revision + 1' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'only the current pointer and root revision advance');
select ok(position('ACCEPTABLE_FOR_TECHNICAL_REVIEW' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'override reason catalogue is bounded');
select ok(position('scan_quality.override_recorded' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'successful override emits the approved audit action');
select ok(position('prior_quality_state' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) > 0, 'audit metadata records only the bounded prior state');
select ok(position('object_key' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) = 0, 'override excludes storage keys');
select ok(position('checksum' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) = 0, 'override excludes checksums');
select ok(position('signed_url' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) = 0, 'override excludes signed URLs');
select ok(position('patient_number' in pg_get_functiondef('graftvision_private.override_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,uuid)'::regprocedure)) = 0, 'override excludes patient identity projections');

select * from finish();
rollback;
