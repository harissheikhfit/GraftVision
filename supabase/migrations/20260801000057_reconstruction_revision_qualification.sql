-- RECONSTRUCTION-001 corrective migration: qualify worker revision updates.
-- graftvision:dangerous-sql-approved task=RECONSTRUCTION-001
-- graftvision:dangerous-sql-reason Returned revision parameters shadow the reconstruction_job revision column.
-- graftvision:corrective-plan Forward-fix only the qualified column references.

do $$
declare
  signature text;
  definition text;
begin
  foreach signature in array array[
    'graftvision_private.claim_reconstruction_job(uuid,uuid,integer)',
    'graftvision_private.renew_reconstruction_job_lease(uuid,uuid,integer)',
    'graftvision_private.update_reconstruction_job_progress(uuid,uuid,integer,integer,text)',
    'graftvision_private.complete_reconstruction_job(uuid,uuid,integer)',
    'graftvision_private.fail_reconstruction_job(uuid,uuid,integer,text)',
    'graftvision_private.retry_reconstruction_job(uuid,uuid,uuid,integer,uuid)',
    'graftvision_private.cancel_reconstruction_job(uuid,uuid,uuid,integer,uuid)'
  ] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    definition := replace(
      definition,
      'set revision=revision+1',
      'set revision=public.reconstruction_job.revision+1'
    );
    definition := replace(
      definition,
      'set revision = revision + 1',
      'set revision = public.reconstruction_job.revision + 1'
    );
    execute definition;
  end loop;
end;
$$;
