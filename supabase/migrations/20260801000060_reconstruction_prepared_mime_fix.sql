-- RECONSTRUCTION-002 corrective migration: persist the required normalized MIME type.
-- graftvision:dangerous-sql-approved task=RECON-002
-- graftvision:dangerous-sql-reason Prepared assets require an explicit MIME type and the synthetic pipeline emits JPEG normalization.
-- graftvision:corrective-plan Add the constrained image/jpeg value to the existing controlled insert.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.record_reconstruction_prepared_asset(uuid,uuid,integer,integer,uuid,text,text,text,integer,integer,uuid)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'source_checksum,normalized_checksum,normalized_width,normalized_height) values(',
    'source_checksum,normalized_checksum,normalized_width,normalized_height,normalized_mime_type) values('
  );
  definition := replace(
    definition,
    'normalized_width,normalized_height,normalized_mime_type) values(',
    'normalized_width,normalized_height,normalized_mime_type,pipeline_version) values('
  );
  definition := replace(
    definition,
    'p_normalized_checksum,p_normalized_width,p_normalized_height,''image/jpeg'') returning id',
    'p_normalized_checksum,p_normalized_width,p_normalized_height,''image/jpeg'',''recon-input-prep-v1'') returning id'
  );
  definition := replace(
    definition,
    'p_normalized_height) returning id',
    'p_normalized_height,''image/jpeg'',''recon-input-prep-v1'') returning id'
  );
  execute definition;
end;
$$;
