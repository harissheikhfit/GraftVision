-- RECONSTRUCTION-002 corrective migration: persist the prepared-manifest pipeline version.
-- graftvision:dangerous-sql-approved task=RECON-002
-- graftvision:dangerous-sql-reason Prepared manifests require the same pipeline lineage as their assets.
-- graftvision:corrective-plan Add the constrained pipeline value to the existing controlled insert.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.finalize_reconstruction_prepared_manifest(uuid,uuid,integer,integer,uuid)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'source_manifest_id,prepared_asset_ids) values(',
    'source_manifest_id,prepared_asset_ids,pipeline_version) values('
  );
  definition := replace(
    definition,
    'j.manifest_id,ids) returning id',
    'j.manifest_id,ids,''recon-input-prep-v1'') returning id'
  );
  execute definition;
end;
$$;
