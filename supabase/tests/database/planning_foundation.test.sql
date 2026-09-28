-- PLAN-002: planning invalidation contract tests. Synthetic schema evidence only.
begin;
select plan(28);

select has_table('public', 'planning_package', 'planning package table exists');
select has_table('public', 'planning_idempotency', 'planning idempotency table exists');
select has_function(
  'graftvision_private',
  'finalize_planning_package',
  array['uuid', 'uuid', 'uuid', 'integer', 'uuid'],
  'controlled planning finalization function exists'
);
select has_function(
  'graftvision_private',
  'invalidate_planning_package',
  array['uuid', 'uuid', 'uuid', 'integer', 'integer', 'uuid'],
  'controlled planning invalidation function exists'
);
select col_not_null('public', 'planning_package', 'clinic_id', 'planning package is tenant bound');
select col_not_null('public', 'planning_package', 'consultation_id', 'planning package is consultation bound');
select col_not_null('public', 'planning_package', 'revision', 'planning package revision is required');
select col_not_null('public', 'planning_package', 'package_state', 'planning package state is required');
select col_not_null('public', 'planning_idempotency', 'payload_hash', 'planning idempotency payload is required');
select col_not_null('public', 'planning_idempotency', 'result_resource_id', 'planning idempotency result is required');
select policies_are('public', 'planning_package', array[]::name[], 'ordinary planning package access is denied');
select policies_are('public', 'planning_idempotency', array[]::name[], 'ordinary planning idempotency access is denied');
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%PLANNING_REVISION_CONFLICT%'),
  'finalization rejects stale revisions'
);
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%IDEMPOTENCY_KEY_REUSED%'),
  'finalization rejects reused idempotency keys'
);
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%set_config(''graftvision.scan_controlled'', ''on'', true)%'),
  'finalization uses controlled mutation context'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%PLANNING_GEOMETRY_REVISION_INVALID%'),
  'invalidation requires a newer geometry revision'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%IDEMPOTENCY_KEY_REUSED%'),
  'invalidation rejects reused idempotency keys'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%PLANNING_NOT_INVALIDATABLE%'),
  'invalidation requires a calculated or finalized package'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%package_state = ''stale''%'),
  'invalidation marks the package stale'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%revision = revision + 1%'),
  'invalidation increments the package revision'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%set_config(''graftvision.scan_controlled'', ''on'', true)%'),
  'invalidation uses controlled mutation context'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%PLANNING_ACCESS_DENIED%'),
  'invalidation rejects a foreign clinic actor'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%planning.invalidated%'),
  'invalidation writes the planning audit action'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%request_family = ''invalidate''%'),
  'invalidation uses a separate idempotency family'
);
select ok(
  (select pg_get_functiondef('graftvision_private.invalidate_planning_package(uuid,uuid,uuid,integer,integer,uuid)'::regprocedure) like '%p_package_id, ''invalidated'', v_package.revision + 1%'),
  'invalidation records an invalidated idempotency result'
);
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%PLANNING_NOT_CALCULATED%'),
  'finalization requires calculated state'
);
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%planning.finalized%'),
  'finalization writes the planning audit action'
);
select ok(
  (select pg_get_functiondef('graftvision_private.finalize_planning_package(uuid,uuid,uuid,integer,uuid)'::regprocedure) like '%request_family = ''finalize''%'),
  'finalization uses a separate idempotency family'
);
select * from finish();
rollback;
