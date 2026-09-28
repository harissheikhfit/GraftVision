-- MODEL-001 corrective migration: persist required model-package provenance.
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Model packages must identify their package and normalization contracts.
-- graftvision:corrective-plan Add the constrained v1 provenance values to the existing controlled insert.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.create_scalp_model_package(uuid,uuid,uuid,uuid)'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'execution_mode,geometry_revision,created_by) values(',
    'execution_mode,geometry_revision,model_package_version,normalization_version,created_by) values('
  );
  definition := replace(
    definition,
    'a.execution_mode,o.attempt_count,c.actor_id)',
    'a.execution_mode,o.attempt_count,''graftvision-model-package-v1'',''graftvision-model-normalization-v1'',c.actor_id)'
  );
  execute definition;
end;
$$;
