-- PLAN-002: preserve invalidation as its own idempotency result status.
-- graftvision:dangerous-sql-approved task=PLAN-002
-- graftvision:dangerous-sql-reason Replayed invalidation must not be reported as finalized planning.
-- graftvision:corrective-plan Forward-fix the additive status constraint and invalidation function.

alter table public.planning_idempotency
  drop constraint planning_idempotency_result_status_check;

alter table public.planning_idempotency
  add constraint planning_idempotency_result_status_check
  check (result_status in ('created', 'replayed', 'finalized', 'invalidated'));

create or replace function graftvision_private.invalidate_planning_package(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_package_id uuid,
  p_expected_revision integer,
  p_geometry_revision integer,
  p_idempotency_key uuid
) returns table (revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_package public.planning_package%rowtype;
  v_actor record;
  v_existing public.planning_idempotency%rowtype;
begin
  select * into strict v_package
  from public.planning_package
  where id = p_package_id
  for update;

  select * into strict v_actor
  from graftvision_private.assert_consultation_doctor_authority(
    p_session_id, p_provider_identity_id, v_package.consultation_id
  );

  if v_package.clinic_id <> v_actor.clinic_id then
    raise exception using errcode = '42501', message = 'PLANNING_ACCESS_DENIED';
  end if;

  select * into v_existing
  from public.planning_idempotency
  where clinic_id = v_package.clinic_id
    and actor_platform_user_id = v_actor.platform_user_id
    and request_family = 'invalidate'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.result_resource_id <> p_package_id then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_existing.result_revision, false;
    return;
  end if;

  if v_package.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PLANNING_REVISION_CONFLICT';
  end if;
  if p_geometry_revision <= v_package.geometry_revision then
    raise exception using errcode = '22023', message = 'PLANNING_GEOMETRY_REVISION_INVALID';
  end if;
  if v_package.package_state not in ('calculated', 'finalized') then
    raise exception using errcode = '22023', message = 'PLANNING_NOT_INVALIDATABLE';
  end if;

  perform set_config('graftvision.scan_controlled', 'on', true);
  update public.planning_package
  set package_state = 'stale', geometry_revision = p_geometry_revision, revision = revision + 1
  where id = p_package_id;

  insert into public.planning_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_status, result_revision
  ) values (
    v_package.clinic_id, v_actor.platform_user_id, 'invalidate', p_idempotency_key,
    encode(extensions.digest(p_package_id::text || ':' || p_expected_revision::text || ':' || p_geometry_revision::text, 'sha256'), 'hex'),
    p_package_id, 'invalidated', v_package.revision + 1
  );

  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_package.clinic_id, v_actor.platform_user_id, 'user', 'planning.invalidated',
    'planning_package', p_package_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('revision', v_package.revision + 1, 'geometry_revision', p_geometry_revision)
  );

  return query select v_package.revision + 1, true;
end;
$$;

revoke all on function graftvision_private.invalidate_planning_package(uuid, uuid, uuid, integer, integer, uuid)
from public, anon, authenticated;