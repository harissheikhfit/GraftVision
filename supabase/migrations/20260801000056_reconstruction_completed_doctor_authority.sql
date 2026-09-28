-- RECONSTRUCTION-001 corrective migration: repair completed-consultation worker preparation.
-- graftvision:dangerous-sql-approved task=RECONSTRUCTION-001
-- graftvision:dangerous-sql-reason Reconstruction starts from a completed, analyzer-ready consultation and must use unambiguous lineage references.
-- graftvision:corrective-plan Forward-fix the existing function; preserve tenant, worker, and readiness checks.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.create_reconstruction_job(uuid,uuid,uuid,integer,uuid)'::regprocedure
  ) into definition;
  definition := replace(definition, 'scan_analyzer_handoff h', 'scan_analyzer_handoff handoff');
  definition := replace(definition, 'ss.id=h.scan_session_id', 'ss.id=handoff.scan_session_id');
  definition := replace(definition, 'where h.id=p_handoff_id', 'where handoff.id=p_handoff_id');
  definition := replace(definition, 'is_assigned_verified_doctor(', 'is_assigned_verified_scan_doctor(');
  execute definition;
end;
$$;
