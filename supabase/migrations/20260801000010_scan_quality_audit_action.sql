-- SCAN-005B1: extend the final strict audit-action allowlist without changing its contract.
do $$
declare validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into validator_definition;
  if position('''scan_quality.validation_saved''' in validator_definition) = 0 then
    validator_definition := replace(
      validator_definition,
      '''scan_capture.preview_accessed''',
      '''scan_capture.preview_accessed'', ''scan_quality.validation_saved'''
    );
    execute validator_definition;
  end if;
end;
$$;
