-- GraftVision migration
-- Task: PLATFORM-ADMIN-002
-- Purpose: Controlled platform-user lifecycle, session revocation, and redacted operational projections.
-- Created UTC: 20260729000005
-- graftvision:dangerous-sql-approved task=PLATFORM-ADMIN-002
-- graftvision:dangerous-sql-reason Reviewed owner-safe lifecycle updates, targeted session revocation, immutable evidence, and redacted projections.
-- graftvision:corrective-plan Forward-fix from the reviewed platform-admin snapshot; historical migrations remain unchanged.

create table public.platform_operational_history (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in (
    'user_deactivate', 'user_reactivate', 'session_revoke_one', 'session_revoke_all'
  )),
  target_platform_user_id uuid not null references public.platform_user(id) on update restrict on delete restrict,
  target_session_id uuid references public.application_session(id) on update restrict on delete restrict,
  actor_platform_user_id uuid not null references public.platform_user(id) on update restrict on delete restrict,
  previous_authorization_version integer,
  new_authorization_version integer,
  reason_code text not null check (reason_code in (
    'SECURITY_RESPONSE', 'ACCESS_REVIEW', 'EMPLOYMENT_CHANGE',
    'OPERATOR_REQUEST', 'ACCOUNT_RESTORED'
  )),
  affected_count integer not null default 1 check (affected_count between 0 and 1000000),
  occurred_at timestamptz not null default clock_timestamp()
);

alter table public.platform_operational_history enable row level security;
alter table public.platform_operational_history force row level security;
revoke all on table public.platform_operational_history from public, anon, authenticated;

create trigger platform_operational_history_immutable
before update or delete on public.platform_operational_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create function graftvision_private.manage_platform_user_lifecycle(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_target_platform_user_id uuid,
  p_operation text,
  p_reason_code text,
  p_expected_authorization_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.platform_user%rowtype;
  v_owner_count integer;
  v_target_is_owner boolean;
  v_new_version integer;
  v_revoked_count integer := 0;
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id, p_provider_identity_id, 'ADMIN-PERM-004'
  ) then
    raise exception using errcode='42501', message='AUTH_PERMISSION_DENIED';
  end if;
  if p_operation not in ('deactivate','reactivate')
    or p_reason_code not in (
      'SECURITY_RESPONSE','ACCESS_REVIEW','EMPLOYMENT_CHANGE',
      'OPERATOR_REQUEST','ACCOUNT_RESTORED'
    )
  then raise exception using errcode='22023', message='INVALID_LIFECYCLE_OPERATION'; end if;

  perform pg_advisory_xact_lock(714025001);
  select * into v_target from public.platform_user
  where id=p_target_platform_user_id for update;
  if not found then raise exception using errcode='22023', message='PLATFORM_USER_NOT_FOUND'; end if;
  if v_target.authorization_version<>p_expected_authorization_version then
    raise exception using errcode='40001', message='PLATFORM_USER_REVISION_CONFLICT';
  end if;

  select exists(
    select 1 from public.platform_user_role
    where platform_user_id=p_target_platform_user_id and role_code='PLATFORM_OWNER'
  ) into v_target_is_owner;
  select count(*) into v_owner_count
  from public.platform_user u join public.platform_user_role r on r.platform_user_id=u.id
  where u.status='active' and r.role_code='PLATFORM_OWNER';

  if p_operation='deactivate' then
    if v_target.status<>'active' then
      raise exception using errcode='40001', message='PLATFORM_USER_ALREADY_INACTIVE';
    end if;
    if v_target_is_owner and v_owner_count<=1 then
      raise exception using errcode='42501', message='FINAL_PLATFORM_OWNER_PROTECTED';
    end if;
    update public.platform_user
    set status='suspended', authorization_version=authorization_version+1
    where id=p_target_platform_user_id returning authorization_version into v_new_version;
    update public.application_session
    set revoked_at=clock_timestamp(), revoke_reason_code='DEACTIVATED',
        updated_at=clock_timestamp()
    where platform_user_id=p_target_platform_user_id
      and authority_scope='platform' and revoked_at is null;
    get diagnostics v_revoked_count = row_count;
  else
    if v_target.status='active' then
      raise exception using errcode='40001', message='PLATFORM_USER_ALREADY_ACTIVE';
    end if;
    update public.platform_user
    set status='active', authorization_version=authorization_version+1
    where id=p_target_platform_user_id returning authorization_version into v_new_version;
  end if;

  insert into public.platform_operational_history(
    action,target_platform_user_id,actor_platform_user_id,
    previous_authorization_version,new_authorization_version,reason_code,affected_count
  ) values(
    case when p_operation='deactivate' then 'user_deactivate' else 'user_reactivate' end,
    p_target_platform_user_id,p_provider_identity_id,v_target.authorization_version,
    v_new_version,p_reason_code,v_revoked_count
  );
  insert into public.audit_event(
    audit_scope,actor_platform_user_id,actor_type,action,resource_type,resource_id,
    outcome,reason_code,source_application,metadata
  ) values(
    'platform',p_provider_identity_id,'user',
    case when p_operation='deactivate' then 'user.deactivate' else 'user.reactivate' end,
    'platform_user',p_target_platform_user_id,'success',p_reason_code,'database',
    jsonb_build_object('affected_count',v_revoked_count)
  );
  return v_new_version;
end;
$$;
revoke all on function graftvision_private.manage_platform_user_lifecycle(
  uuid,uuid,uuid,text,text,integer
) from public, anon, authenticated;

create function graftvision_private.revoke_platform_user_sessions(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_target_platform_user_id uuid,
  p_target_session_id uuid,
  p_revoke_all boolean,
  p_reason_code text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer := 0; v_history_session uuid;
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'ADMIN-PERM-004'
  ) then raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED'; end if;
  if p_reason_code not in ('SECURITY_RESPONSE','ACCESS_REVIEW','OPERATOR_REQUEST')
    or not exists(select 1 from public.platform_user where id=p_target_platform_user_id)
  then raise exception using errcode='22023',message='INVALID_SESSION_REVOCATION'; end if;
  if p_target_platform_user_id=p_provider_identity_id and (p_revoke_all or p_target_session_id=p_session_id)
  then raise exception using errcode='42501',message='CURRENT_OWNER_SESSION_PROTECTED'; end if;

  if p_revoke_all then
    update public.application_session
    set revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ALL',updated_at=clock_timestamp()
    where platform_user_id=p_target_platform_user_id and authority_scope='platform'
      and revoked_at is null;
  else
    if p_target_session_id is null or not exists(
      select 1 from public.application_session
      where id=p_target_session_id and platform_user_id=p_target_platform_user_id
        and authority_scope='platform'
    ) then raise exception using errcode='22023',message='PLATFORM_SESSION_NOT_FOUND'; end if;
    update public.application_session
    set revoked_at=clock_timestamp(),revoke_reason_code='REVOKE_ONE',updated_at=clock_timestamp()
    where id=p_target_session_id and platform_user_id=p_target_platform_user_id
      and authority_scope='platform' and revoked_at is null;
  end if;
  get diagnostics v_count = row_count;
  v_history_session:=case when p_revoke_all then null else p_target_session_id end;
  if v_count>0 then
    insert into public.platform_operational_history(
      action,target_platform_user_id,target_session_id,actor_platform_user_id,
      reason_code,affected_count
    ) values(
      case when p_revoke_all then 'session_revoke_all' else 'session_revoke_one' end,
      p_target_platform_user_id,v_history_session,p_provider_identity_id,p_reason_code,v_count
    );
    insert into public.audit_event(
      audit_scope,actor_platform_user_id,actor_type,action,resource_type,resource_id,
      outcome,reason_code,source_application,metadata
    ) values(
      'platform',p_provider_identity_id,'user',
      case when p_revoke_all then 'session.revoke_others' else 'session.revoke_other' end,
      'application_session',coalesce(v_history_session,p_target_platform_user_id),
      'success',p_reason_code,'database',jsonb_build_object('affected_count',v_count)
    );
  end if;
  return v_count;
end;
$$;
revoke all on function graftvision_private.revoke_platform_user_sessions(
  uuid,uuid,uuid,uuid,boolean,text
) from public, anon, authenticated;

create function graftvision_private.read_platform_session_health(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_result jsonb;
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'TENANT-ACCESS-002'
  ) or p_limit not between 1 and 50
  then raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED'; end if;

  with classified as (
    select s.*,
      case
        when s.revoked_at is not null then 'revoked'
        when s.absolute_expires_at<=clock_timestamp() then 'expired'
        when s.platform_authorization_version<>u.authorization_version then 'stale'
        when s.locked_at is not null then 'locked'
        else 'active'
      end as health_status
    from public.application_session s
    join public.platform_user u on u.id=s.platform_user_id
    where s.authority_scope='platform'
  ), page as (
    select * from classified
    where p_before_created_at is null
      or (created_at,id)<(p_before_created_at,coalesce(p_before_id,'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid))
    order by created_at desc,id desc limit p_limit
  )
  select jsonb_build_object(
    'activeCount',(select count(*) from classified where health_status='active'),
    'staleCount',(select count(*) from classified where health_status='stale'),
    'revokedCount',(select count(*) from classified where health_status='revoked'),
    'expiredCount',(select count(*) from classified where health_status='expired'),
    'lockedCount',(select count(*) from classified where health_status='locked'),
    'users',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',u.id,'status',u.status,'authorizationVersion',u.authorization_version,
      'platformRoles',(select coalesce(jsonb_agg(r.role_code order by r.role_code),'[]'::jsonb)
        from public.platform_user_role r where r.platform_user_id=u.id)
    ) order by u.created_at,u.id),'[]'::jsonb) from public.platform_user u),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'platformUserId',platform_user_id,'scope',authority_scope,
      'status',health_status,'createdAt',created_at,'lastActivityAt',last_activity_at,
      'expiresAt',absolute_expires_at,'revokedAt',revoked_at
    ) order by created_at desc,id desc) from page),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function graftvision_private.read_platform_session_health(
  uuid,uuid,timestamptz,uuid,integer
) from public, anon, authenticated;

create function graftvision_private.read_filtered_platform_audit(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_before_occurred_at timestamptz default null,
  p_before_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_action text default null,
  p_clinic_reference uuid default null,
  p_limit integer default 25
)
returns table(
  id uuid,actor_reference uuid,clinic_reference uuid,action text,reason_code text,
  audit_scope text,outcome text,authorization_revision integer,occurred_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'AUDIT-PERM-001'
  ) or p_limit not between 1 and 50 or (p_from is not null and p_to is not null and p_from>p_to)
  then raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED'; end if;
  if p_action is not null and not graftvision_private.is_valid_audit_action(p_action)
  then raise exception using errcode='22023',message='INVALID_AUDIT_FILTER'; end if;

  insert into public.audit_event(
    audit_scope,actor_platform_user_id,actor_type,action,resource_type,
    outcome,reason_code,source_application,metadata
  ) values(
    'platform',p_provider_identity_id,'user','platform.admin','audit_event',
    'success','PLATFORM_AUDIT_VIEWED','database',jsonb_build_object('affected_count',p_limit)
  );

  return query
  select a.id,a.actor_platform_user_id,
    case when a.resource_type in ('clinic','clinic_membership') then a.clinic_id else null end,
    a.action,a.reason_code,a.audit_scope,a.outcome,
    case when a.metadata->>'new_status' ~ '^[0-9]+$' then (a.metadata->>'new_status')::integer else null end,
    a.occurred_at
  from public.audit_event a
  where a.audit_scope='platform'
    and a.resource_type not in (
      'patient','patient_privacy_acknowledgement','patient_registration','patient_status'
    )
    and (p_before_occurred_at is null or (a.occurred_at,a.id)<(
      p_before_occurred_at,coalesce(p_before_id,'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid)
    ))
    and (p_from is null or a.occurred_at>=p_from)
    and (p_to is null or a.occurred_at<=p_to)
    and (p_action is null or a.action=p_action)
    and (p_clinic_reference is null or a.clinic_id=p_clinic_reference)
  order by a.occurred_at desc,a.id desc limit p_limit;
end;
$$;
revoke all on function graftvision_private.read_filtered_platform_audit(
  uuid,uuid,timestamptz,uuid,timestamptz,timestamptz,text,uuid,integer
) from public, anon, authenticated;
