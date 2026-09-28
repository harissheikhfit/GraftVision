-- SCAN-004: controlled previews and database-authoritative completion readiness.

create function graftvision_private.require_scan_capture_completion_assets()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status = 'paired' and exists (
    select 1 from public.scan_capture_state where scan_session_id = new.id and capture_status = 'capture_complete'
  ) and 7 <> (select count(*) from public.scan_capture_asset where scan_session_id = new.id and upload_status = 'uploaded') then
    raise exception using errcode = '42501', message = 'SCAN_CAPTURE_UPLOADS_REQUIRED';
  end if;
  return new;
end;
$$;
create trigger scan_session_capture_assets_required before update of status on public.scan_session
for each row execute function graftvision_private.require_scan_capture_completion_assets();

create function graftvision_private.read_scan_capture_preview(
  p_session_id uuid, p_provider_identity_id uuid, p_scan_session_id uuid, p_asset_id uuid
) returns table (asset_id uuid, object_key text, mime_type text)
language plpgsql security definer set search_path = '' as $$
declare v_context record;
begin
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,p_scan_session_id);
  return query select a.id,a.object_key,a.mime_type from public.scan_capture_asset a
  where a.id=p_asset_id and a.scan_session_id=p_scan_session_id and a.clinic_id=v_context.clinic_id and a.upload_status='uploaded';
  if not found then raise exception using errcode='42501',message='SCAN_PREVIEW_DENIED'; end if;
  insert into public.audit_event (audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata)
  values ('clinic',v_context.clinic_id,v_context.actor_id,'user','scan_capture.preview_accessed','scan_capture_asset',p_asset_id,'success',gen_random_uuid(),'database',jsonb_build_object('access','preview'));
end;
$$;
revoke all on function graftvision_private.read_scan_capture_preview(uuid,uuid,uuid,uuid) from public,anon,authenticated;
