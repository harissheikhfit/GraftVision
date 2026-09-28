begin;
select plan(20);

select has_table('public', 'reconstruction_artifact_geometry', 'real output geometry is stored separately from private object references');
select has_column('public', 'reconstruction_artifact', 'execution_mode', 'artifact records retain a bounded execution mode');
select has_column('public', 'reconstruction_artifact', 'adapter_version', 'artifact records retain a bounded adapter version');
select has_column('public', 'reconstruction_output_manifest', 'execution_mode', 'output manifests retain execution mode');
select has_column('public', 'reconstruction_output_manifest', 'adapter_version', 'output manifests retain adapter version');
select has_function('graftvision_private', 'record_real_reconstruction_artifact', array['uuid','uuid','integer','integer','uuid','text','text','text','integer','text','text','text','text','text','uuid'], 'real artifact recording remains worker-controlled');
select has_function('graftvision_private', 'finalize_real_reconstruction_output', array['uuid','uuid','integer','integer','uuid','integer','integer','integer','numeric[]','numeric[]','text','uuid'], 'real output finalization remains worker-controlled');
select col_has_check('public', 'reconstruction_artifact', 'artifact_type', 'artifact types stay exact');
select col_has_check('public', 'reconstruction_artifact', 'mime_type', 'MIME types stay exact');
select col_has_check('public', 'reconstruction_artifact', 'engine_name', 'engine names stay exact');
select col_has_check('public', 'reconstruction_artifact', 'engine_version', 'engine versions stay exact');
select col_has_check('public', 'reconstruction_artifact', 'adapter_version', 'adapter versions stay exact');
select col_has_check('public', 'reconstruction_artifact', 'configuration_version', 'configuration versions stay exact');
select col_has_check('public', 'reconstruction_artifact', 'execution_mode', 'execution modes stay exact');
select col_has_check('public', 'reconstruction_artifact_geometry', 'point_count', 'point counts stay bounded');
select col_has_check('public', 'reconstruction_artifact_geometry', 'vertex_count', 'vertex counts stay bounded');
select col_has_check('public', 'reconstruction_artifact_geometry', 'face_count', 'face counts stay bounded');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.reconstruction_artifact_geometry'::regclass), true, 'geometry metadata has forced RLS');
select is((select count(*) from pg_trigger where tgrelid='public.reconstruction_artifact_geometry'::regclass and not tgisinternal), 1::bigint, 'geometry metadata rejects direct mutation');
select is_empty('select * from information_schema.role_table_grants where table_schema=''public'' and table_name=''reconstruction_artifact_geometry'' and grantee in (''anon'',''authenticated'')', 'normal roles cannot access geometry metadata');

select * from finish();
rollback;
