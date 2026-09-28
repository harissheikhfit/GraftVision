-- SCAN-005B2c: strict audit evidence for controlled quality retake requests.
create or replace function graftvision_private.is_valid_audit_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_key text;
  metadata_value jsonb;
begin
  if candidate is null
    or jsonb_typeof(candidate) <> 'object'
    or octet_length(convert_to(candidate::text, 'UTF8')) > 2048 then
    return false;
  end if;

  for metadata_key, metadata_value in
    select key, value from jsonb_each(candidate)
  loop
    case metadata_key
      when 'affected_count', 'current_revision', 'expected_revision', 'new_version', 'result_revision' then
        if jsonb_typeof(metadata_value) <> 'number'
          or metadata_value::text !~ '^[0-9]{1,7}$'
          or metadata_value::text::bigint > 1000000 then
          return false;
        end if;
      when 'changed_fields' then
        if jsonb_typeof(metadata_value) <> 'array'
          or jsonb_array_length(metadata_value) > 32
          or exists (
            select 1
            from jsonb_array_elements(metadata_value) as item(value)
            where jsonb_typeof(item.value) <> 'string'
              or item.value #>> '{}' !~ '^[a-z][a-z0-9_]{0,62}$'
          ) then
          return false;
        end if;
      when 'scan_session_id', 'asset_id' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return false;
        end if;
      when 'assigned_role', 'capture_step', 'device_label', 'error_code', 'new_status',
           'operation_code', 'outcome_code', 'policy_decision_code', 'previous_status',
           'quality_state', 'removed_role', 'reason_code', 'route_family',
           'storage_object_class', 'validator_version' then
        if jsonb_typeof(metadata_value) <> 'string'
          or metadata_value #>> '{}' !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

do $$
declare
  validator_definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure)
  into validator_definition;

  if position('''scan_quality.retake_requested''' in validator_definition) = 0 then
    validator_definition := replace(
      validator_definition,
      '''scan_quality.validation_saved''',
      '''scan_quality.validation_saved'', ''scan_quality.retake_requested'''
    );
    execute validator_definition;
  end if;
end;
$$;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'graftvision_private.request_scan_quality_retake(uuid,uuid,uuid,uuid,text,integer,text,text)'::regprocedure
  ) into function_definition;

  if position('scan_quality.retake_requested' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      '  insert into public.scan_capture_quality_retake_idempotency (',
      $audit$  insert into public.audit_event (
        audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
        resource_type, resource_id, outcome, request_id, source_application, metadata
      ) values (
        'clinic', v_context.clinic_id, v_context.actor_id, 'user',
        'scan_quality.retake_requested', 'scan_capture_quality_result', v_result_id,
        'success', null, 'database', jsonb_build_object(
          'scan_session_id', p_scan_session_id,
          'asset_id', p_asset_id,
          'capture_step', p_capture_step,
          'reason_code', p_reason_code,
          'result_revision', v_review.revision + 1
        )
      );

  insert into public.scan_capture_quality_retake_idempotency ($audit$
    );
    execute function_definition;
  end if;
end;
$$;
