-- SCAN-005B1 corrective migration: qualify the quality-review revision update.
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason The output parameter named revision must not shadow the persisted review column.
-- graftvision:corrective-plan Forward-fix the existing function without changing its public contract.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.save_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,text)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'update public.scan_capture_quality_review set revision=revision+1 where id=r.id',
    'update public.scan_capture_quality_review set revision=public.scan_capture_quality_review.revision+1 where id=r.id'
  );
  execute definition;
end;
$$;
