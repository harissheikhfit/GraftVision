-- MODEL-001 corrective migration: permit model review after consultation completion.
-- graftvision:dangerous-sql-approved task=MODEL-001
-- graftvision:dangerous-sql-reason Model packages and draft annotations are downstream of completed reconstruction evidence.
-- graftvision:corrective-plan Replace authorization only in functions with model-specific denial contracts.

do $$
declare
  row record;
  definition text;
begin
  for row in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'graftvision_private'
      and p.prosrc ~ 'MODEL_(ACCESS|ANNOTATION|LANDMARK|CURVE|REGION)_DENIED'
      and p.prosrc like '%is_assigned_verified_doctor%'
  loop
    select pg_get_functiondef(row.oid) into definition;
    definition := replace(
      definition,
      'is_assigned_verified_doctor(',
      'is_assigned_verified_scan_doctor('
    );
    execute definition;
  end loop;
end;
$$;
