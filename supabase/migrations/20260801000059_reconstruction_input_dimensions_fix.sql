-- RECONSTRUCTION-001 corrective migration: align worker input projection with stored media metadata.
-- graftvision:dangerous-sql-approved task=RECONSTRUCTION-001
-- graftvision:dangerous-sql-reason scan_capture_asset stores byte size but not source pixel dimensions.
-- graftvision:corrective-plan Return nullable dimensions until the media contract stores them; do not fabricate metadata.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.read_reconstruction_worker_input(uuid,uuid,integer)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'a.byte_size,a.width,a.height,',
    'a.byte_size::bigint,null::integer,null::integer,'
  );
  execute definition;
end;
$$;
