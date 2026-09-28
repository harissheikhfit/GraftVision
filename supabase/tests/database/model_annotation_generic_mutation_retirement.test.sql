begin;
select plan(6);
select has_function('graftvision_private','save_model_annotation',array['uuid','uuid','uuid','text','text','jsonb','integer','uuid'],'deprecated generic entrypoint remains explicit');
select throws_ok($$select * from graftvision_private.save_model_annotation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'landmark','glabella_reference','{}'::jsonb,1,gen_random_uuid())$$,'42501','MODEL_ANNOTATION_GENERIC_DEPRECATED','generic mutation path is safely rejected');
select policies_are('public','model_annotation_package',array[]::name[],'package remains deny-all to normal users');
select policies_are('public','model_annotation_landmark_current',array[]::name[],'current pointers remain deny-all to normal users');
select is_empty($$select * from information_schema.role_routine_grants where routine_schema='graftvision_private' and routine_name='save_model_annotation' and grantee in ('anon','authenticated')$$,'generic mutation remains unavailable to clinic users');
select throws_ok($$insert into public.model_annotation_event(annotation_package_id,clinic_id,event_type,actor_platform_user_id) values(gen_random_uuid(),gen_random_uuid(),'landmark_saved',gen_random_uuid())$$,null,null,'direct event mutation remains denied');
select * from finish(); rollback;
