-- SCAN-005B1: atomic redacted audit evidence for a newly saved quality result.
do $$
declare function_definition text;
begin
  select pg_get_functiondef('graftvision_private.save_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,text)'::regprocedure) into function_definition;
  if position('scan_quality.validation_saved' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      'return query select nid,r.revision+1,true;',
      $audit$insert into public.audit_event (audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata) values ('clinic',c.clinic_id,c.actor_id,'user','scan_quality.validation_saved','scan_capture_quality_result',nid,'success',p_idempotency_key::uuid,'database',jsonb_build_object('scan_session_id',p_scan_session_id,'asset_id',p_asset_id,'capture_step',p_capture_step,'quality_state',p_quality_state,'validator_version',p_validator_version,'result_revision',r.revision+1)); return query select nid,r.revision+1,true;$audit$
    );
    execute function_definition;
  end if;
end;
$$;
