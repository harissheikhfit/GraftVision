-- MODEL-001B2b3: private, tombstone-safe annotation read projections.
create function graftvision_private.read_model_annotations(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_annotation_package_id uuid
) returns table(
  annotation_package_id uuid,
  model_package_id uuid,
  annotation_package_version text,
  package_state text,
  package_revision integer,
  geometry_revision integer,
  normalization_version text,
  created_at timestamptz,
  finalized_at timestamptz,
  landmark_count integer,
  curve_count integer,
  region_count integer,
  active_annotations jsonb,
  inactive_annotations jsonb
)
language plpgsql security definer set search_path='' as $$
declare
  p public.model_annotation_package%rowtype;
  m public.scalp_model_package%rowtype;
begin
  select * into strict p from public.model_annotation_package where id=p_annotation_package_id;
  select * into strict m from public.scalp_model_package where id=p.model_package_id;
  perform graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,m.scan_session_id);
  if p.package_state not in ('draft','finalized')
     or p.clinic_id<>m.clinic_id or p.patient_id<>m.patient_id or p.consultation_id<>m.consultation_id
     or p.reconstruction_output_manifest_id<>m.reconstruction_output_manifest_id
     or p.model_artifact_id<>m.reconstruction_artifact_id
     or p.geometry_revision<>m.geometry_revision
     or p.normalization_version<>m.normalization_version
     or not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,p.consultation_id,'CONSULT-PERM-001') then
    raise exception using errcode='42501',message='MODEL_ANNOTATION_READ_DENIED';
  end if;

  return query
  with current_rows as (
    select 'landmark'::text as annotation_kind, c.landmark_code as annotation_code, c.current_version_id as version_id,
      c.revision as pointer_revision, c.updated_at, v.lifecycle_state, v.revision as version_revision,
      jsonb_build_object('annotation_id',v.id,'annotation_kind','landmark','annotation_code',v.landmark_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'normalized_coordinate',to_jsonb(v.normalized_coordinate),'geometry_revision',v.geometry_revision,
        'created_at',v.created_at,'updated_at',c.updated_at) as active_value,
      jsonb_build_object('annotation_id',v.id,'annotation_kind','landmark','annotation_code',v.landmark_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'geometry_revision',v.geometry_revision,'created_at',v.created_at,'updated_at',c.updated_at) as inactive_value
    from public.model_annotation_landmark_current c join public.model_annotation_landmark_version v on v.id=c.current_version_id
    where c.annotation_package_id=p.id
    union all
    select 'curve', c.curve_code, c.current_version_id, c.revision, c.updated_at, v.lifecycle_state, v.revision,
      jsonb_build_object('annotation_id',v.id,'annotation_kind','curve','annotation_code',v.curve_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'control_points',v.control_points,'closed',v.closed,'smoothing_mode',v.smoothing_mode,
        'geometry_revision',v.geometry_revision,'created_at',v.created_at,'updated_at',c.updated_at),
      jsonb_build_object('annotation_id',v.id,'annotation_kind','curve','annotation_code',v.curve_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'geometry_revision',v.geometry_revision,'created_at',v.created_at,'updated_at',c.updated_at)
    from public.model_annotation_curve_current c join public.model_annotation_curve_version v on v.id=c.current_version_id
    where c.annotation_package_id=p.id
    union all
    select 'region', c.region_code, c.current_version_id, c.revision, c.updated_at, v.lifecycle_state, v.revision,
      jsonb_build_object('annotation_id',v.id,'annotation_kind','region','annotation_code',v.region_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'boundary_points',v.boundary_points,'closed',v.closed,'geometry_revision',v.geometry_revision,
        'created_at',v.created_at,'updated_at',c.updated_at),
      jsonb_build_object('annotation_id',v.id,'annotation_kind','region','annotation_code',v.region_code,
        'lifecycle_state',v.lifecycle_state,'pointer_revision',c.revision,'version_revision',v.revision,
        'geometry_revision',v.geometry_revision,'created_at',v.created_at,'updated_at',c.updated_at)
    from public.model_annotation_region_current c join public.model_annotation_region_version v on v.id=c.current_version_id
    where c.annotation_package_id=p.id
  )
  select p.id,p.model_package_id,p.annotation_package_version,p.package_state,p.revision,p.geometry_revision,p.normalization_version,p.created_at,p.finalized_at,
    count(*) filter (where annotation_kind='landmark' and lifecycle_state='active')::integer,
    count(*) filter (where annotation_kind='curve' and lifecycle_state='active')::integer,
    count(*) filter (where annotation_kind='region' and lifecycle_state='active')::integer,
    coalesce(jsonb_agg(active_value order by annotation_kind,annotation_code,version_revision,updated_at,version_id) filter (where lifecycle_state='active'),'[]'::jsonb),
    coalesce(jsonb_agg(inactive_value order by annotation_kind,annotation_code,version_revision,updated_at,version_id) filter (where lifecycle_state='tombstone'),'[]'::jsonb)
  from current_rows;
end; $$;

create function graftvision_private.read_model_annotation_history(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_annotation_package_id uuid
) returns table(
  annotation_kind text,
  annotation_code text,
  version_id uuid,
  lifecycle_state text,
  version_revision integer,
  supersedes_version_id uuid,
  created_at timestamptz,
  package_revision integer,
  event_type text
)
language plpgsql security definer set search_path='' as $$
declare
  p public.model_annotation_package%rowtype;
  m public.scalp_model_package%rowtype;
begin
  select * into strict p from public.model_annotation_package where id=p_annotation_package_id;
  select * into strict m from public.scalp_model_package where id=p.model_package_id;
  perform graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,m.scan_session_id);
  if p.package_state not in ('draft','finalized')
     or p.clinic_id<>m.clinic_id or p.patient_id<>m.patient_id or p.consultation_id<>m.consultation_id
     or p.reconstruction_output_manifest_id<>m.reconstruction_output_manifest_id
     or p.model_artifact_id<>m.reconstruction_artifact_id
     or p.geometry_revision<>m.geometry_revision
     or p.normalization_version<>m.normalization_version
     or not graftvision_private.is_assigned_verified_doctor(p_session_id,p_provider_identity_id,p.consultation_id,'CONSULT-PERM-001') then
    raise exception using errcode='42501',message='MODEL_ANNOTATION_READ_DENIED';
  end if;

  return query
  with versions as (
    select 'landmark'::text as annotation_kind, landmark_code as annotation_code, id as version_id, lifecycle_state, revision as version_revision, supersedes_landmark_id as supersedes_version_id, created_at from public.model_annotation_landmark_version where annotation_package_id=p.id
    union all select 'curve',curve_code,id,lifecycle_state,revision,supersedes_curve_id,created_at from public.model_annotation_curve_version where annotation_package_id=p.id
    union all select 'region',region_code,id,lifecycle_state,revision,supersedes_region_id,created_at from public.model_annotation_region_version where annotation_package_id=p.id
  )
  select v.annotation_kind,v.annotation_code,v.version_id,v.lifecycle_state,v.version_revision,v.supersedes_version_id,v.created_at,e.revision,e.event_type
  from versions v
  left join lateral (
    select event_type,revision from public.model_annotation_event
    where annotation_package_id=p.id and annotation_reference_id=v.version_id
    order by occurred_at,id limit 1
  ) e on true
  order by v.annotation_kind,v.annotation_code,v.version_revision,v.created_at,v.version_id;
end; $$;

revoke all on function graftvision_private.read_model_annotations(uuid,uuid,uuid),graftvision_private.read_model_annotation_history(uuid,uuid,uuid) from public,anon,authenticated;
