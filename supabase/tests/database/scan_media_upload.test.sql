-- SCAN-004 private-media invariants. Synthetic schema assertions only.
begin;
select plan(18);

select has_table('public', 'scan_capture_asset', 'capture assets are persisted separately from image bytes');
select has_table('public', 'scan_capture_upload_event', 'upload lifecycle evidence is persisted');
select has_table('public', 'scan_capture_upload_idempotency', 'upload retries have controlled idempotency');
select has_function('graftvision_private', 'read_scan_capture_preview', array['uuid','uuid','uuid','uuid'], 'preview uses a controlled same-session function');
select has_function('graftvision_private', 'require_scan_capture_completion_assets', array[]::text[], 'completion gate is database-authoritative');
select col_not_null('public', 'scan_capture_asset', 'clinic_id', 'assets are tenant bound');
select col_not_null('public', 'scan_capture_asset', 'scan_session_id', 'assets are scan-session bound');
select col_not_null('public', 'scan_capture_asset', 'checksum', 'verified uploads retain a checksum');
select col_not_null('public', 'scan_capture_asset', 'object_key', 'private objects retain an internal key only');
select col_is_pk('public', 'scan_capture_asset', 'id', 'assets have opaque identities');
select policies_are('public', 'scan_capture_asset', array[]::name[], 'no ordinary asset-table access policy exists');
select policies_are('public', 'scan_capture_upload_event', array[]::name[], 'no ordinary event-table access policy exists');
select throws_ok($$ insert into public.scan_capture_asset (id) values (gen_random_uuid()) $$, null, null, 'direct asset mutation is blocked');
select throws_ok($$ insert into public.scan_capture_upload_event (scan_capture_asset_id,clinic_id,event_type,actor_platform_user_id) values (gen_random_uuid(),gen_random_uuid(),'uploaded',gen_random_uuid()) $$, null, null, 'direct event mutation is blocked');
select ok(position('bytea' in pg_get_functiondef('graftvision_private.read_scan_capture_preview(uuid,uuid,uuid,uuid)'::regprocedure)) = 0, 'safe preview projection excludes image bytes');
select ok(position('object_key text' in pg_get_functiondef('graftvision_private.read_scan_capture_preview(uuid,uuid,uuid,uuid)'::regprocedure)) > 0, 'object key remains server-only function output');
select ok(position('checksum' in pg_get_functiondef('graftvision_private.read_scan_capture_preview(uuid,uuid,uuid,uuid)'::regprocedure)) = 0, 'preview projection excludes checksum');
select ok(position('signed' in pg_get_functiondef('graftvision_private.read_scan_capture_preview(uuid,uuid,uuid,uuid)'::regprocedure)) = 0, 'preview function never stores signed URLs');

select * from finish();
rollback;
