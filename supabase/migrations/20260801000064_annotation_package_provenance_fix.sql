-- MODEL-001B corrective migration: persist annotation package provenance.
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Annotation packages must pin normalization and package contract versions.
-- graftvision:corrective-plan Add the constrained v1 values to the existing controlled insert.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.create_model_annotation_package(uuid,uuid,uuid,integer,uuid)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'model_artifact_id,geometry_revision,created_by) values(',
    'model_artifact_id,geometry_revision,normalization_version,annotation_package_version,created_by) values('
  );
  definition := replace(
    definition,
    'm.reconstruction_artifact_id,m.geometry_revision,c.actor_id)',
    'm.reconstruction_artifact_id,m.geometry_revision,''graftvision-model-normalization-v1'',''graftvision-model-annotations-v1'',c.actor_id)'
  );
  execute definition;
end;
$$;
