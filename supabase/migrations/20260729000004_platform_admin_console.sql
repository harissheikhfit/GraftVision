-- GraftVision migration
-- Task: PLATFORM-ADMIN-001
-- Purpose: Controlled first-owner bootstrap and bounded platform clinic administration.
-- Created UTC: 20260729000004
-- graftvision:dangerous-sql-approved task=PLATFORM-ADMIN-001
-- graftvision:dangerous-sql-reason Approved additive permission, controlled operations, immutable history, redacted projections, and audit evidence.
-- graftvision:corrective-plan Forward-fix from the reviewed platform-admin snapshot; historical migrations remain unchanged.

insert into public.permission_definition (permission_id) values ('ADMIN-PERM-007');
insert into public.role_permission (role_code, permission_id)
values ('PLATFORM_OWNER', 'ADMIN-PERM-007');

create table public.platform_admin_history (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in (
    'owner_bootstrap', 'clinic_metadata_update', 'clinic_admin_assign',
    'clinic_admin_replace', 'clinic_admin_remove'
  )),
  clinic_id uuid references public.clinic(id) on update restrict on delete restrict,
  target_platform_user_id uuid references public.platform_user(id) on update restrict on delete restrict,
  actor_platform_user_id uuid references public.platform_user(id) on update restrict on delete restrict,
  previous_revision integer,
  new_revision integer,
  reason_code text not null check (reason_code ~ '^[A-Z][A-Z0-9_]{1,62}$'),
  occurred_at timestamptz not null default clock_timestamp()
);

alter table public.platform_admin_history enable row level security;
alter table public.platform_admin_history force row level security;
revoke all on table public.platform_admin_history from public, anon, authenticated;

create trigger platform_admin_history_immutable
before update or delete on public.platform_admin_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create or replace function graftvision_private.is_platform_metadata_permission(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'TENANT-ACCESS-002', 'ADMIN-PERM-004', 'ADMIN-PERM-005',
    'ADMIN-PERM-006', 'ADMIN-PERM-007', 'AUDIT-PERM-001', 'ROLE-010',
    'EXPORT-PERM-002', 'SUPPORT-PERM-002', 'SUPPORT-PERM-003'
  );
$$;

create function graftvision_private.has_platform_owner_admin_authority(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_permission_id text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select graftvision_private.has_application_session_permission(
    p_session_id, p_provider_identity_id, 'platform', null, p_permission_id
  ) and exists (
    select 1
    from public.application_session s
    join public.platform_user_role r on r.platform_user_id = s.platform_user_id
    where s.id = p_session_id
      and s.platform_user_id = p_provider_identity_id
      and s.authority_scope = 'platform'
      and r.role_code = 'PLATFORM_OWNER'
  );
$$;
revoke all on function graftvision_private.has_platform_owner_admin_authority(uuid,uuid,text)
from public, anon, authenticated;

create function graftvision_private.bootstrap_first_platform_owner(
  p_provider_identity_id uuid,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
begin
  if p_provider_identity_id is null
    or p_owner_email is null
    or p_owner_email <> lower(btrim(p_owner_email))
    or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using errcode='22023', message='INVALID_OWNER_IDENTITY';
  end if;

  select u.id into v_existing
  from public.platform_user u
  join public.platform_user_role r on r.platform_user_id=u.id
  where r.role_code='PLATFORM_OWNER'
  order by u.created_at limit 1
  for update of u;

  if v_existing is not null then
    if v_existing = p_provider_identity_id
      and exists (
        select 1 from public.platform_user
        where id=v_existing and lower(external_identity_id)=p_owner_email and status='active'
      ) then
      return v_existing;
    end if;
    raise exception using errcode='42501', message='PLATFORM_OWNER_ALREADY_EXISTS';
  end if;

  insert into public.platform_user(id, external_identity_id, status)
  values (p_provider_identity_id, p_owner_email, 'active')
  on conflict (id) do update
    set external_identity_id=excluded.external_identity_id, status='active'
  where public.platform_user.external_identity_id is null
     or lower(public.platform_user.external_identity_id)=p_owner_email;

  if not exists (
    select 1 from public.platform_user
    where id=p_provider_identity_id and lower(external_identity_id)=p_owner_email and status='active'
  ) then
    raise exception using errcode='42501', message='OWNER_IDENTITY_CONFLICT';
  end if;

  insert into public.platform_user_role(platform_user_id, role_code)
  values (p_provider_identity_id, 'PLATFORM_OWNER');

  insert into public.platform_admin_history(
    action,target_platform_user_id,actor_platform_user_id,reason_code
  ) values ('owner_bootstrap',p_provider_identity_id,p_provider_identity_id,'FIRST_OWNER_BOOTSTRAPPED');

  insert into public.audit_event(
    audit_scope,actor_platform_user_id,actor_type,action,resource_type,resource_id,
    outcome,reason_code,source_application,metadata
  ) values (
    'platform',p_provider_identity_id,'user','platform.admin','platform_user',
    p_provider_identity_id,'success','FIRST_OWNER_BOOTSTRAPPED','database',
    jsonb_build_object('new_status','PLATFORM_OWNER')
  );
  return p_provider_identity_id;
end;
$$;
revoke all on function graftvision_private.bootstrap_first_platform_owner(uuid,text)
from public, anon, authenticated;

create function graftvision_private.read_platform_dashboard(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'TENANT-ACCESS-002'
  ) then
    raise exception using errcode='42501', message='AUTH_PERMISSION_DENIED';
  end if;

  select jsonb_build_object(
    'totalClinics',count(*),
    'activeClinics',count(*) filter(where c.status='active'),
    'suspendedClinics',count(*) filter(where c.status='suspended'),
    'inactiveClinics',count(*) filter(where c.status='inactive'),
    'readyClinics',count(*) filter(where coalesce(r.state,'not_ready')='ready'),
    'notReadyClinics',count(*) filter(where coalesce(r.state,'not_ready')<>'ready'),
    'clinics',coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'clinicCode',c.clinic_code,'displayName',c.display_name,
      'timezone',c.timezone,'status',c.status,'revision',c.revision,
      'readinessState',coalesce(r.state,'not_ready'),
      'readinessRevision',coalesce(r.revision,0),
      'administrators',(select count(*) from public.clinic_membership m
        join public.clinic_membership_role mr on mr.clinic_membership_id=m.id
        where m.clinic_id=c.id and m.membership_status='active' and mr.role_code='CLINIC_ADMIN')
    ) order by c.created_at,c.id),'[]'::jsonb)
  ) into v_result
  from public.clinic c
  left join public.clinic_onboarding_readiness r on r.clinic_id=c.id;
  return v_result;
end;
$$;
revoke all on function graftvision_private.read_platform_dashboard(uuid,uuid)
from public, anon, authenticated;

create function graftvision_private.update_platform_clinic_metadata(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_id uuid,
  p_display_name text,
  p_timezone text,
  p_expected_revision integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_current public.clinic%rowtype; v_fields text[] := '{}';
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'ADMIN-PERM-006'
  ) then raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED'; end if;
  if p_display_name<>btrim(p_display_name) or length(p_display_name) not between 1 and 160
    or not graftvision_private.is_valid_iana_timezone(p_timezone)
  then raise exception using errcode='22023',message='INVALID_CLINIC_METADATA'; end if;
  select * into v_current from public.clinic where id=p_clinic_id for update;
  if not found then raise exception using errcode='22023',message='CLINIC_NOT_FOUND'; end if;
  if v_current.revision<>p_expected_revision then
    raise exception using errcode='40001',message='CLINIC_REVISION_CONFLICT';
  end if;
  if v_current.display_name is distinct from p_display_name then v_fields:=array_append(v_fields,'display_name'); end if;
  if v_current.timezone is distinct from p_timezone then v_fields:=array_append(v_fields,'timezone'); end if;
  if cardinality(v_fields)=0 then return v_current.revision; end if;
  perform set_config('graftvision.clinic_settings_controlled','on',true);
  update public.clinic set display_name=p_display_name,timezone=p_timezone,
    revision=revision+1,updated_by_platform_user_id=p_provider_identity_id where id=p_clinic_id;
  perform set_config('graftvision.clinic_settings_controlled','off',true);
  insert into public.clinic_settings_history(
    clinic_id,previous_revision,new_revision,changed_fields,reason_code,actor_platform_user_id
  ) values(p_clinic_id,v_current.revision,v_current.revision+1,v_fields,'PROFILE_UPDATED',p_provider_identity_id);
  insert into public.platform_admin_history(
    action,clinic_id,actor_platform_user_id,previous_revision,new_revision,reason_code
  ) values('clinic_metadata_update',p_clinic_id,p_provider_identity_id,v_current.revision,v_current.revision+1,'PLATFORM_METADATA_UPDATED');
  insert into public.audit_event(
    audit_scope,actor_platform_user_id,actor_type,action,resource_type,resource_id,
    outcome,reason_code,source_application,metadata
  ) values('platform',p_provider_identity_id,'user','platform.admin','clinic',p_clinic_id,
    'success','PLATFORM_METADATA_UPDATED','database',jsonb_build_object('changed_fields',to_jsonb(v_fields)));
  return v_current.revision+1;
end;
$$;
revoke all on function graftvision_private.update_platform_clinic_metadata(
  uuid,uuid,uuid,text,text,integer
) from public, anon, authenticated;

create function graftvision_private.manage_platform_clinic_administrator(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_id uuid,
  p_target_platform_user_id uuid,
  p_operation text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id uuid; v_previous uuid[]; v_action text;
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'ADMIN-PERM-007'
  ) then raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED'; end if;
  if p_operation not in ('assign','replace','remove')
    or not exists(select 1 from public.clinic where id=p_clinic_id and status='active')
  then raise exception using errcode='22023',message='INVALID_ADMIN_OPERATION'; end if;
  if p_operation<>'remove' and not exists(
    select 1 from public.platform_user
    where id=p_target_platform_user_id and status='active' and external_identity_id is not null
  ) then raise exception using errcode='22023',message='INVALID_ADMIN_TARGET'; end if;

  select coalesce(array_agg(m.id),'{}') into v_previous
  from public.clinic_membership m join public.clinic_membership_role mr on mr.clinic_membership_id=m.id
  where m.clinic_id=p_clinic_id and mr.role_code='CLINIC_ADMIN'
    and (p_operation in ('replace','remove') or m.platform_user_id=p_target_platform_user_id);

  if p_operation in ('replace','remove') then
    delete from public.clinic_membership_role
    where role_code='CLINIC_ADMIN' and clinic_membership_id=any(v_previous);
    update public.application_session set revoked_at=clock_timestamp(),revoke_reason_code='SCOPE_CHANGE'
    where authority_scope='clinic' and clinic_id=p_clinic_id and revoked_at is null
      and platform_user_id in (
        select platform_user_id from public.clinic_membership where id=any(v_previous)
      );
  end if;

  if p_operation<>'remove' then
    insert into public.clinic_membership(clinic_id,platform_user_id,membership_status)
    values(p_clinic_id,p_target_platform_user_id,'active')
    on conflict(clinic_id,platform_user_id) do update set membership_status='active'
    returning id into v_membership_id;
    insert into public.clinic_membership_role(clinic_membership_id,role_code)
    values(v_membership_id,'CLINIC_ADMIN') on conflict do nothing;
  else
    select id into v_membership_id from public.clinic_membership
    where clinic_id=p_clinic_id and platform_user_id=p_target_platform_user_id;
  end if;
  v_action:=case p_operation when 'assign' then 'clinic_admin_assign'
    when 'replace' then 'clinic_admin_replace' else 'clinic_admin_remove' end;
  insert into public.platform_admin_history(
    action,clinic_id,target_platform_user_id,actor_platform_user_id,reason_code
  ) values(v_action,p_clinic_id,p_target_platform_user_id,p_provider_identity_id,
    upper(p_operation)||'_CLINIC_ADMIN');
  insert into public.audit_event(
    audit_scope,actor_platform_user_id,actor_type,action,resource_type,resource_id,
    outcome,reason_code,source_application,metadata
  ) values('platform',p_provider_identity_id,'user','platform.admin','clinic_membership',
    v_membership_id,'success',upper(p_operation)||'_CLINIC_ADMIN','database',
    jsonb_build_object('affected_count',greatest(cardinality(v_previous),1)));
  return v_membership_id;
end;
$$;
revoke all on function graftvision_private.manage_platform_clinic_administrator(
  uuid,uuid,uuid,uuid,text
) from public, anon, authenticated;

create function graftvision_private.read_platform_audit(
  p_session_id uuid,p_provider_identity_id uuid,p_before timestamptz default null,p_limit integer default 25
)
returns table(
  id uuid,actor_reference uuid,clinic_reference uuid,action text,reason_code text,
  audit_scope text,outcome text,occurred_at timestamptz
)
language plpgsql security definer set search_path=''
as $$
begin
  if not graftvision_private.has_platform_owner_admin_authority(
    p_session_id,p_provider_identity_id,'AUDIT-PERM-001'
  ) or p_limit not between 1 and 50 then
    raise exception using errcode='42501',message='AUTH_PERMISSION_DENIED';
  end if;
  return query select a.id,a.actor_platform_user_id,
    case when a.resource_type='clinic' then a.resource_id else null end,
    a.action,a.reason_code,a.audit_scope,a.outcome,a.occurred_at
  from public.audit_event a
  where a.audit_scope='platform' and (p_before is null or a.occurred_at<p_before)
    and a.resource_type not in ('patient','patient_privacy_acknowledgement')
  order by a.occurred_at desc,a.id desc limit p_limit;
end;
$$;
revoke all on function graftvision_private.read_platform_audit(uuid,uuid,timestamptz,integer)
from public, anon, authenticated;
