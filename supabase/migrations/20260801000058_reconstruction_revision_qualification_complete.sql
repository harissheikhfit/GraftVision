-- RECONSTRUCTION-001 corrective migration: qualify every reconstruction job revision update.
-- graftvision:dangerous-sql-approved task=RECONSTRUCTION-001
-- graftvision:dangerous-sql-reason Reconstruction lifecycle functions expose revision values that can shadow the table column.
-- graftvision:corrective-plan Rewrite only functions that update reconstruction_job and only the shadowed column expression.

do $$
declare
  row record;
  definition text;
  signature text;
begin
  for row in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'graftvision_private'
      and p.prosrc like '%update public.reconstruction_job%'
  loop
    signature := row.oid::regprocedure::text;
    select pg_get_functiondef(row.oid) into definition;
    definition := replace(
      definition,
      'revision=revision+1',
      'revision=public.reconstruction_job.revision+1'
    );
    definition := replace(
      definition,
      'revision = revision + 1',
      'revision = public.reconstruction_job.revision + 1'
    );
    definition := replace(
      definition,
      'attempt_count=attempt_count+1',
      'attempt_count=public.reconstruction_job.attempt_count+1'
    );
    execute definition;
  end loop;
end;
$$;
