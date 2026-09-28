-- AI-MAP-002C corrective migration: authorize downstream proposal work after completion.
-- graftvision:dangerous-sql-approved task=AI-MAP-002C
-- graftvision:dangerous-sql-reason AI-MAP consumes completed reconstruction/model evidence.
-- graftvision:corrective-plan Replace authorization only in AI-MAP functions with proposal/model denial contracts.

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
      and p.prosrc ~ 'AI_MAP_QUEUE_DENIED|ANNOTATION_PACKAGE_WRITE_DENIED|AI_MAP_DECISION_DENIED'
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
