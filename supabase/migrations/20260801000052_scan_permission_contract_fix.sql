-- SCAN-002 corrective migration: use the authoritative scan permission catalog.
-- graftvision:dangerous-sql-approved task=SCAN-002
-- graftvision:dangerous-sql-reason Replace only stale scan permission identifiers; tenant, RLS, and security-definer semantics remain unchanged.
-- graftvision:corrective-plan Forward-fix through a later additive migration; no roles or permission definitions are added.

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'graftvision_private.create_scan_session(uuid,uuid,uuid,uuid,uuid,text,timestamptz,text)',
    'graftvision_private.pair_scan_session(uuid,uuid,uuid,text,text)',
    'graftvision_private.transition_scan_session_status(uuid,uuid,uuid,text,text,text)',
    'graftvision_private.redeem_scan_session_token(uuid,uuid,text,text,text)',
    'graftvision_private.read_scan_session_status(uuid,uuid,uuid)',
    'graftvision_private.require_scan_capture_context(uuid,uuid,uuid)'
  ] loop
    execute replace(
      pg_get_functiondef(to_regprocedure(function_signature)),
      'CLINICAL-PERM-002',
      'SCAN-PERM-001'
    );
  end loop;
end;
$$;

alter policy scan_session_select on public.scan_session using (
  clinic_id = graftvision_private.current_clinic_id()
  and graftvision_private.has_permission(
    graftvision_private.current_platform_user_id(),
    graftvision_private.current_clinic_id(),
    'SCAN-PERM-001'
  )
);

alter policy scan_session_event_select on public.scan_session_event using (
  clinic_id = graftvision_private.current_clinic_id()
  and graftvision_private.has_permission(
    graftvision_private.current_platform_user_id(),
    graftvision_private.current_clinic_id(),
    'SCAN-PERM-001'
  )
);

alter policy scan_capture_state_select on public.scan_capture_state using (
  clinic_id = graftvision_private.current_clinic_id()
  and graftvision_private.has_permission(
    graftvision_private.current_platform_user_id(),
    graftvision_private.current_clinic_id(),
    'SCAN-PERM-001'
  )
);

alter policy scan_capture_event_select on public.scan_capture_event using (
  clinic_id = graftvision_private.current_clinic_id()
  and graftvision_private.has_permission(
    graftvision_private.current_platform_user_id(),
    graftvision_private.current_clinic_id(),
    'SCAN-PERM-001'
  )
);