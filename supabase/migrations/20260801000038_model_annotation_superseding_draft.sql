-- MODEL-001B2b4: controlled draft succession over immutable finalized annotations.
alter table public.model_annotation_package
  add column supersedes_package_id uuid references public.model_annotation_package(id);

create unique index model_annotation_one_draft_per_model_package
  on public.model_annotation_package (model_package_id)
  where package_state = 'draft';

create function graftvision_private.create_superseding_model_annotation_draft(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_source_annotation_package_id uuid,
  p_expected_source_revision integer,
  p_idempotency_key uuid
) returns table(
  annotation_package_id uuid,
  source_annotation_package_id uuid,
  package_state text,
  source_package_state text,
  package_revision integer,
  geometry_revision integer,
  copied_landmark_count integer,
  copied_curve_count integer,
  copied_region_count integer,
  created_at timestamptz,
  is_new boolean
)
language plpgsql security definer set search_path='' as $$
declare
  s public.model_annotation_package%rowtype;
  n public.model_annotation_package%rowtype;
  m public.scalp_model_package%rowtype;
  c record;
  e public.model_annotation_idempotency%rowtype;
  h text;
  landmarks integer:=0;
  curves integer:=0;
  regions integer:=0;
begin
  
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation superseding-draft lineage transitions.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
select * into strict s from public.model_annotation_package where id=p_source_annotation_package_id for update;
  select * into strict m from public.scalp_model_package where id=s.model_package_id;
  select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,m.scan_session_id);
  if s.clinic_id<>m.clinic_id or s.patient_id<>m.patient_id or s.consultation_id<>m.consultation_id
     or s.reconstruction_output_manifest_id<>m.reconstruction_output_manifest_id
     or s.model_artifact_id<>m.reconstruction_artifact_id
     or s.geometry_revision<>m.geometry_revision
     or s.normalization_version<>m.normalization_version
     or not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,s.consultation_id,'CONSULT-PERM-001') then
    raise exception using errcode='42501',message='MODEL_ANNOTATION_SUPERSEDING_DRAFT_DENIED';
  end if;
  h:=encode(extensions.digest(concat_ws(':',p_source_annotation_package_id,p_expected_source_revision),'sha256'),'hex');
  select * into e from public.model_annotation_idempotency where clinic_id=s.clinic_id and actor_platform_user_id=c.actor_id and request_family='package' and idempotency_key=p_idempotency_key;
  if found then
    if e.payload_hash<>h then raise exception using errcode='40001',message='MODEL_ANNOTATION_IDEMPOTENCY_MISMATCH'; end if;
    select * into strict n from public.model_annotation_package where id=e.result_resource_id;
    select count(*) into landmarks from public.model_annotation_landmark_current where annotation_package_id=n.id;
    select count(*) into curves from public.model_annotation_curve_current where annotation_package_id=n.id;
    select count(*) into regions from public.model_annotation_region_current where annotation_package_id=n.id;
    return query select n.id,s.id,n.package_state,s.package_state,n.revision,n.geometry_revision,landmarks,curves,regions,n.created_at,false;
    return;
  end if;
  if s.package_state<>'finalized' or s.revision<>p_expected_source_revision then
    raise exception using errcode=case when s.revision<>p_expected_source_revision then '40001' else '42501' end,
      message=case when s.revision<>p_expected_source_revision then 'MODEL_ANNOTATION_CONFLICT' else 'MODEL_ANNOTATION_SUPERSEDING_DRAFT_DENIED' end;
  end if;
  perform pg_advisory_xact_lock(hashtext('model-annotation-draft:'||s.model_package_id::text));
  if exists(select 1 from public.model_annotation_package where model_package_id=s.model_package_id and package_state='draft') then
    raise exception using errcode='40001',message='MODEL_ANNOTATION_DRAFT_EXISTS';
  end if;
  perform set_config('graftvision.scan_controlled','on',true);
  insert into public.model_annotation_package(clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,normalization_version,annotation_package_version,package_state,revision,created_by,supersedes_package_id)
  values(s.clinic_id,s.patient_id,s.consultation_id,s.model_package_id,s.reconstruction_output_manifest_id,s.model_artifact_id,s.geometry_revision,s.normalization_version,'graftvision-model-annotations-v1','draft',1,c.actor_id,s.id)
  returning * into n;

  insert into public.model_annotation_landmark_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,landmark_code,normalized_coordinate,surface_reference,coordinate_frame_version,revision,created_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,v.landmark_code,v.normalized_coordinate,v.surface_reference,v.coordinate_frame_version,1,c.actor_id
  from public.model_annotation_landmark_current q join public.model_annotation_landmark_version v on v.id=q.current_version_id
  where q.annotation_package_id=s.id and v.lifecycle_state='active';
  get diagnostics landmarks = row_count;
  insert into public.model_annotation_landmark_current(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,normalization_version,landmark_code,current_version_id,revision,updated_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,n.normalization_version,v.landmark_code,v.id,1,c.actor_id
  from public.model_annotation_landmark_version v where v.annotation_package_id=n.id and v.lifecycle_state='active';

  insert into public.model_annotation_curve_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,curve_code,control_points,closed,smoothing_mode,revision,created_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,v.curve_code,v.control_points,v.closed,v.smoothing_mode,1,c.actor_id
  from public.model_annotation_curve_current q join public.model_annotation_curve_version v on v.id=q.current_version_id
  where q.annotation_package_id=s.id and v.lifecycle_state='active';
  get diagnostics curves = row_count;
  insert into public.model_annotation_curve_current(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,normalization_version,curve_code,current_version_id,revision,updated_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,n.normalization_version,v.curve_code,v.id,1,c.actor_id
  from public.model_annotation_curve_version v where v.annotation_package_id=n.id and v.lifecycle_state='active';

  insert into public.model_annotation_region_version(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,region_code,boundary_points,closed,revision,created_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,v.region_code,v.boundary_points,v.closed,1,c.actor_id
  from public.model_annotation_region_current q join public.model_annotation_region_version v on v.id=q.current_version_id
  where q.annotation_package_id=s.id and v.lifecycle_state='active';
  get diagnostics regions = row_count;
  insert into public.model_annotation_region_current(annotation_package_id,clinic_id,patient_id,consultation_id,model_package_id,reconstruction_output_manifest_id,model_artifact_id,geometry_revision,normalization_version,region_code,current_version_id,revision,updated_by)
  select n.id,v.clinic_id,v.patient_id,v.consultation_id,v.model_package_id,v.reconstruction_output_manifest_id,v.model_artifact_id,v.geometry_revision,n.normalization_version,v.region_code,v.id,1,c.actor_id
  from public.model_annotation_region_version v where v.annotation_package_id=n.id and v.lifecycle_state='active';

  -- graftvision:dangerous-sql-approved task=MODEL-001
  -- graftvision:dangerous-sql-reason A finalized immutable source changes only to bounded lineage state after its successor exists.
  -- graftvision:corrective-plan Forward-fix via an additive migration; source versions and pointers remain append-only.
  
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Controlled row locks and revision updates serialize immutable Doctor annotation superseding-draft lineage transitions.
-- graftvision:corrective-plan Forward-fix through an additive migration; append-only annotation versions, pointers, events, and audit history remain preserved.
update public.model_annotation_package set package_state='superseded' where id=s.id;
  insert into public.model_annotation_event(annotation_package_id,clinic_id,event_type,actor_platform_user_id,revision) values(n.id,n.clinic_id,'package_created',c.actor_id,n.revision),(s.id,s.clinic_id,'superseded',c.actor_id,s.revision);
  insert into public.audit_event(audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata)
  values
    ('clinic',n.clinic_id,c.actor_id,'user','model.annotation_package_created','consultation',n.consultation_id,'success',p_idempotency_key,'web',jsonb_build_object('annotation_package_id',n.id,'model_package_id',n.model_package_id,'revision',n.revision,'package_state','draft','geometry_revision',n.geometry_revision)),
    ('clinic',s.clinic_id,c.actor_id,'user','model.annotation_superseded','consultation',s.consultation_id,'success',p_idempotency_key,'web',jsonb_build_object('annotation_package_id',s.id,'model_package_id',s.model_package_id,'revision',s.revision,'package_state','superseded','geometry_revision',s.geometry_revision));
  insert into public.model_annotation_idempotency(clinic_id,actor_platform_user_id,request_family,idempotency_key,payload_hash,result_resource_id,result_status,result_revision)
  values(s.clinic_id,c.actor_id,'package',p_idempotency_key,h,n.id,'created',n.revision);
  return query select n.id,s.id,n.package_state,'superseded',n.revision,n.geometry_revision,landmarks,curves,regions,n.created_at,true;
end; $$;

revoke all on function graftvision_private.create_superseding_model_annotation_draft(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
