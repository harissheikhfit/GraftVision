-- MODEL-001B2b2b: typed landmark save with immutable versions and a current pointer.
do $$ declare definition text; begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_metadata(jsonb)'::regprocedure) into definition;
  definition:=replace(definition, $replace$'scan_session_id', 'asset_id'$replace$, $replace$'scan_session_id', 'asset_id', 'annotation_package_id', 'model_package_id'$replace$);
  definition:=replace(definition, $replace$'result_revision'$replace$, $replace$'result_revision', 'revision', 'geometry_revision'$replace$);
  definition:=replace(definition, $replace$'validator_version'$replace$, $replace$'validator_version', 'annotation_kind', 'annotation_code', 'package_state'$replace$);
  execute definition;
end; $$;

create function graftvision_private.save_model_landmark(p_session_id uuid,p_provider_identity_id uuid,p_annotation_package_id uuid,p_landmark_code text,p_x numeric,p_y numeric,p_z numeric,p_surface_reference text,p_expected_package_revision integer,p_expected_pointer_revision integer,p_idempotency_key uuid)
returns table(landmark_version_id uuid,package_revision integer,pointer_revision integer,is_new boolean)
language plpgsql security definer set search_path='' as $$ declare p public.model_annotation_package%rowtype; m public.scalp_model_package%rowtype; c record; q public.model_annotation_landmark_current%rowtype; e public.model_annotation_idempotency%rowtype; v uuid; h text; begin
 
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation saves.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
select * into strict p from public.model_annotation_package where id=p_annotation_package_id for update;
 select * into strict m from public.scalp_model_package where id=p.model_package_id;
 select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,m.scan_session_id);
 if p.package_state<>'draft' or p.clinic_id<>m.clinic_id or p.patient_id<>m.patient_id or p.consultation_id<>m.consultation_id or p.reconstruction_output_manifest_id<>m.reconstruction_output_manifest_id or p.model_artifact_id<>m.reconstruction_artifact_id or p.geometry_revision<>m.geometry_revision or p.normalization_version<>'graftvision-model-normalization-v1' or not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,p.consultation_id,'CONSULT-PERM-001') then raise exception using errcode='42501',message='MODEL_LANDMARK_DENIED'; end if;
 if p.revision<>p_expected_package_revision or p_landmark_code not in ('glabella_reference','frontal_midline_reference','left_temporal_reference','right_temporal_reference','crown_center_reference','left_occipital_reference','right_occipital_reference','donor_center_reference','custom_technical_reference') or p_x::text in ('NaN','Infinity','-Infinity') or p_y::text in ('NaN','Infinity','-Infinity') or p_z::text in ('NaN','Infinity','-Infinity') or p_surface_reference is not null and p_surface_reference !~ '^[A-Za-z0-9._:-]{1,128}$' then raise exception using errcode='22023',message='MODEL_LANDMARK_INVALID'; end if;
 h:=encode(extensions.digest(concat_ws(':',p_annotation_package_id,p_landmark_code,p_x,p_y,p_z,coalesce(p_surface_reference,''),p_expected_package_revision,p_expected_pointer_revision),'sha256'),'hex');
 select * into e from public.model_annotation_idempotency where clinic_id=p.clinic_id and actor_platform_user_id=c.actor_id and request_family='landmark' and idempotency_key=p_idempotency_key; if found then if e.payload_hash<>h then raise exception using errcode='40001',message='MODEL_LANDMARK_IDEMPOTENCY_MISMATCH'; end if; return query select e.result_resource_id,e.result_revision,e.result_revision,false; return; end if;
 
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation saves.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
select * into q from public.model_annotation_landmark_current where annotation_package_id=p.id and landmark_code=p_landmark_code for update;
 if found and q.revision<>p_expected_pointer_revision then raise exception using errcode='40001',message='MODEL_LANDMARK_POINTER_CONFLICT'; end if;
 if not found and p_expected_pointer_revision<>0 then raise exception using errcode='40001',message='MODEL_LANDMARK_POINTER_CONFLICT'; end if;
 perform set_config('graftvision.scan_controlled','on',true);
 insert into public.model_annotation_landmark_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,landmark_code,normalized_coordinate,surface_reference,coordinate_frame_version,revision,supersedes_landmark_id,created_by) values(p.id,p.clinic_id,p.patient_id,p.consultation_id,p.model_package_id,p.reconstruction_output_manifest_id,p.model_artifact_id,p.geometry_revision,p_landmark_code,array[p_x,p_y,p_z],p_surface_reference,p.normalization_version,p.revision+1,case when found then q.current_version_id else null end,c.actor_id) returning id into v;
 insert into public.model_annotation_landmark_current(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,normalization_version,landmark_code,current_version_id,prior_version_id,revision,updated_by) values(p.id,p.clinic_id,p.patient_id,p.consultation_id,p.model_package_id,p.reconstruction_output_manifest_id,p.model_artifact_id,p.geometry_revision,p.normalization_version,p_landmark_code,v,case when found then q.current_version_id else null end,1,c.actor_id) 
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation saves.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
on conflict(annotation_package_id,landmark_code) do update set current_version_id=excluded.current_version_id,prior_version_id=model_annotation_landmark_current.current_version_id,revision=model_annotation_landmark_current.revision+1,updated_at=clock_timestamp(),updated_by=excluded.updated_by returning revision into pointer_revision;
 
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation saves.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
update public.model_annotation_package set revision=revision+1 where id=p.id returning revision into package_revision;
 insert into public.model_annotation_event(annotation_package_id,clinic_id,event_type,actor_platform_user_id,annotation_reference_id,annotation_code,revision) values(p.id,p.clinic_id,'landmark_saved',c.actor_id,v,p_landmark_code,package_revision);
 insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values('clinic',p.clinic_id,c.actor_id,'user','model.landmark_saved','consultation',p.consultation_id,'success',p_idempotency_key,'web',jsonb_build_object('annotation_package_id',p.id,'model_package_id',p.model_package_id,'annotation_kind','landmark','annotation_code',p_landmark_code,'revision',package_revision,'package_state','draft','geometry_revision',p.geometry_revision));
 insert into public.model_annotation_idempotency(clinic_id,actor_platform_user_id,request_family,idempotency_key,payload_hash,result_resource_id,result_status,result_revision) values(p.clinic_id,c.actor_id,'landmark',p_idempotency_key,h,v,'created',package_revision); return query select v,package_revision,pointer_revision,true; end; $$;
revoke all on function graftvision_private.save_model_landmark(uuid,uuid,uuid,text,numeric,numeric,numeric,text,integer,integer,uuid) from public,anon,authenticated;
