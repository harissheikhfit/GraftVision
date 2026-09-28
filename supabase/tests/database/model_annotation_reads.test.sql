begin;
select plan(20);

select has_function('graftvision_private','read_model_annotations',array['uuid','uuid','uuid'],'current annotation projection exists');
select has_function('graftvision_private','read_model_annotation_history',array['uuid','uuid','uuid'],'history projection exists');
select ok(position('require_scan_capture_context' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'current read requires trusted session context');
select ok(position('is_assigned_verified_doctor' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'current read requires verified assigned Doctor');
select ok(position('MODEL_ANNOTATION_READ_DENIED' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'wrong clinic and stale bindings fail safely');
select ok(position('lifecycle_state=''active''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'active annotations are explicit');
select ok(position('lifecycle_state=''tombstone''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'tombstones are explicitly inactive');
select ok(position('''normalized_coordinate''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'landmark editor coordinate projection is bounded');
select ok(position('''control_points''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'curve editor points are projected');
select ok(position('''boundary_points''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'region editor points are projected');
select ok(position('''smoothing_mode''' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'curve smoothing is projected');
select ok(position('order by annotation_kind,annotation_code,version_revision,updated_at,version_id' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))>0,'current ordering is deterministic');
select ok(position('order by v.annotation_kind,v.annotation_code,v.version_revision,v.created_at,v.version_id' in pg_get_functiondef('graftvision_private.read_model_annotation_history(uuid,uuid,uuid)'::regprocedure))>0,'history ordering is deterministic');
select ok(position('model_annotation_event' in pg_get_functiondef('graftvision_private.read_model_annotation_history(uuid,uuid,uuid)'::regprocedure))>0,'history uses bounded annotation events');
select ok(position('storage_key' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))=0,'current projection excludes storage paths');
select ok(position('signed_url' in pg_get_functiondef('graftvision_private.read_model_annotations(uuid,uuid,uuid)'::regprocedure))=0,'current projection excludes signed URLs');
select ok(position('idempotency' in pg_get_functiondef('graftvision_private.read_model_annotation_history(uuid,uuid,uuid)'::regprocedure))=0,'history excludes idempotency material');
select function_privs_are('graftvision_private','read_model_annotations',array['uuid','uuid','uuid'],'authenticated',array[]::text[],'authenticated cannot call current projection directly');
select function_privs_are('graftvision_private','read_model_annotation_history',array['uuid','uuid','uuid'],'authenticated',array[]::text[],'authenticated cannot call history projection directly');
select policies_are('public','model_annotation_package',array[]::name[],'base package remains deny-all');

select * from finish();
rollback;
