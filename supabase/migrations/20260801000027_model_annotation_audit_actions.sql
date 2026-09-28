-- MODEL-001B2a: exact audit actions for controlled model annotations.
do $$
declare validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure)
  into validator_definition;

  if position('''model.annotation_package_created''' in validator_definition) = 0 then
    validator_definition := replace(
      validator_definition,
      '''reconstruction.execution_failed''',
      '''reconstruction.execution_failed'', ''model.annotation_package_created'', ''model.landmark_saved'', ''model.curve_saved'', ''model.region_saved'', ''model.annotation_finalized'', ''model.annotation_superseded'''
    );
    execute validator_definition;
  end if;
end;
$$;
