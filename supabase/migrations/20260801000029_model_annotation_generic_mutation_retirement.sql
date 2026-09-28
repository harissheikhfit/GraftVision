-- MODEL-001B2b2a: retire the incomplete generic mutation entrypoint.
create or replace function graftvision_private.save_model_annotation(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_package_id uuid,
  p_kind text,
  p_code text,
  p_payload jsonb,
  p_expected_revision integer,
  p_idempotency_key uuid
)
returns table(annotation_id uuid, revision integer, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'MODEL_ANNOTATION_GENERIC_DEPRECATED';
end;
$$;

revoke all on function graftvision_private.save_model_annotation(uuid, uuid, uuid, text, text, jsonb, integer, uuid) from public, anon, authenticated;
