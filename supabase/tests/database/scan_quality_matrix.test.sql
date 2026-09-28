begin;
select plan(42);

select has_function('graftvision_private', 'read_scan_quality_matrix', array['uuid','uuid','uuid'], 'matrix uses a controlled trusted read');
select has_function('graftvision_private', 'read_scan_package_readiness', array['uuid','uuid','uuid'], 'readiness uses a controlled trusted read');
select has_function('graftvision_private', 'read_scan_package_readiness', array['uuid'], 'database readiness predicate remains available');
select ok(position('required_steps' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'empty matrix always represents required angles');
select ok(position('''front''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'front is represented');
select ok(position('''left_profile''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'left profile is represented');
select ok(position('''right_profile''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'right profile is represented');
select ok(position('''crown''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'crown is represented');
select ok(position('''donor_rear''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'donor rear is represented');
select ok(position('''donor_left''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'donor left is represented');
select ok(position('''donor_right''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'donor right is represented');
select ok(position('scan_capture_quality_current' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'matrix reads current pointers rather than client-selected history');
select ok(position('upload_status <> ''uploaded''' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'superseded assets become stale');
select ok(position('asset_revision <> asset.capture_revision' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'stale quality results are identified');
select ok(position('require_scan_capture_context' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) > 0, 'matrix requires trusted same-clinic Doctor context');
select ok(position('require_scan_capture_context' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'readiness requires trusted same-clinic Doctor context');
select ok(position('MISSING_REQUIRED_ASSET' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'missing assets are bounded blockers');
select ok(position('MISSING_QUALITY_RESULT' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'missing results are bounded blockers');
select ok(position('QUALITY_PENDING' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'pending quality blocks readiness');
select ok(position('QUALITY_WARNING' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'warnings block readiness');
select ok(position('RETAKE_REQUIRED' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'retakes block readiness');
select ok(position('QUALITY_INVALIDATED' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'invalidated quality blocks readiness');
select ok(position('SESSION_NOT_ELIGIBLE' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'revoked or expired sessions block readiness');
select ok(position('CONSULTATION_NOT_ANALYZER_READY' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid,uuid,uuid)'::regprocedure)) > 0, 'analyzer readiness loss blocks scan readiness');
select ok(position('doctor_overridden' in pg_get_functiondef('graftvision_private.read_scan_package_readiness(uuid)'::regprocedure)) > 0, 'Doctor-overridden angles can count ready');
select ok(position('object_key' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) = 0, 'matrix excludes storage paths');
select ok(position('checksum' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) = 0, 'matrix excludes checksums');
select ok(position('signed_url' in pg_get_functiondef('graftvision_private.read_scan_quality_matrix(uuid,uuid,uuid)'::regprocedure)) = 0, 'matrix excludes signed URLs');

select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(800,1080,160,128,0.5,1,false)$$,
  $$values ('retake_required:IMAGE_TOO_SMALL')$$,
  'minimum dimensions require a retake'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,40,128,0.5,1,false)$$,
  $$values ('retake_required:IMAGE_TOO_BLURRY')$$,
  'blur requires a retake'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,160,20,0.5,1,false)$$,
  $$values ('retake_required:IMAGE_TOO_DARK')$$,
  'underexposure requires a retake'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,160,240,0.5,1,false)$$,
  $$values ('retake_required:IMAGE_TOO_BRIGHT')$$,
  'overexposure requires a retake'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,160,128,0.5,6,false)$$,
  $$values ('retake_required:INVALID_ORIENTATION')$$,
  'invalid orientation requires a retake'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,160,128,0.02,1,false)$$,
  $$values ('warning:SUBJECT_TOO_FAR')$$,
  'framing distance returns a bounded warning'
);
select results_eq(
  $$select quality_state || ':' || reason_code from graftvision_private.assess_scan_technical_metrics(1080,1080,160,128,0.5,1,true)$$,
  $$values ('retake_required:DUPLICATE_ANGLE_IMAGE')$$,
  'duplicate checksum across angles requires a retake'
);
select results_eq(
  $$select quality_state || coalesce(':' || reason_code,'') from graftvision_private.assess_scan_technical_metrics(1080,1080,160,128,0.5,1,false)$$,
  $$values ('passed')$$,
  'technical validator returns a pass without free text'
);
select throws_ok(
  $$select * from graftvision_private.assess_scan_technical_metrics(1080,1080,-1,128,0.5,1,false)$$,
  '22023', 'SCAN_TECHNICAL_METRICS_INVALID', 'invalid technical metrics are denied'
);
select has_trigger('public', 'scan_capture_asset', 'scan_capture_asset_quality_invalidation', 'asset replacement invalidates prior quality state');
select has_table('public', 'scan_analyzer_handoff', 'append-only analyzer handoff exists');
select has_function('graftvision_private', 'create_scan_analyzer_handoff', array['uuid','uuid','uuid','integer','uuid'], 'handoff uses a controlled database operation');
select policies_are('public', 'scan_analyzer_handoff', array[]::name[], 'ordinary handoff reads are denied');
select ok(position('read_scan_package_readiness' in pg_get_functiondef('graftvision_private.create_scan_analyzer_handoff(uuid,uuid,uuid,integer,uuid)'::regprocedure)) > 0, 'handoff recalculates trusted readiness');

select * from finish();
rollback;
