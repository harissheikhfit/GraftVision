-- Migration: SCAN-004 private scan-media metadata. Image bytes remain in private object storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-private', 'clinical-private', false, 10485760, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.scan_capture_asset (
  id uuid primary key,
  clinic_id uuid not null references public.clinic(id) on delete restrict,
  patient_id uuid not null references public.patient(id) on delete restrict,
  consultation_id uuid not null,
  scan_session_id uuid not null references public.scan_session(id) on delete restrict,
  capture_step text not null check (capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  capture_revision integer not null check (capture_revision > 0),
  object_key text not null unique check (object_key ~ '^clinics/[0-9a-f-]{36}/patients/[0-9a-f-]{36}/consultations/[0-9a-f-]{36}/clinical-image-original/(front|left_profile|right_profile|crown|donor_rear|donor_left|donor_right)/[0-9a-f-]{36}/v[0-9]{4}/original\.(jpeg|png|webp)$'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  upload_status text not null check (upload_status in ('uploaded','superseded')),
  supersedes_asset_id uuid references public.scan_capture_asset(id) on delete restrict,
  created_by uuid not null references public.platform_user(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint scan_capture_asset_session_fk foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id) on delete restrict
);
create unique index scan_capture_asset_current_angle_unique on public.scan_capture_asset(scan_session_id, capture_step) where upload_status = 'uploaded';

create table public.scan_capture_upload_event (
  id uuid primary key default gen_random_uuid(), scan_capture_asset_id uuid not null references public.scan_capture_asset(id) on delete restrict,
  clinic_id uuid not null references public.clinic(id) on delete restrict, event_type text not null check (event_type in ('uploaded','superseded')),
  actor_platform_user_id uuid not null references public.platform_user(id) on delete restrict, occurred_at timestamptz not null default clock_timestamp()
);
create table public.scan_capture_upload_idempotency (
  clinic_id uuid not null references public.clinic(id) on delete restrict,
  actor_platform_user_id uuid not null references public.platform_user(id) on delete restrict,
  idempotency_key text not null,
  scan_session_id uuid not null references public.scan_session(id) on delete restrict,
  scan_capture_asset_id uuid not null references public.scan_capture_asset(id) on delete restrict,
  capture_step text not null check (capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 10485760),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  capture_revision integer not null check (capture_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, idempotency_key)
);
alter table public.scan_capture_asset enable row level security;
alter table public.scan_capture_asset force row level security;
alter table public.scan_capture_upload_event enable row level security;
alter table public.scan_capture_upload_event force row level security;
alter table public.scan_capture_upload_idempotency enable row level security;
alter table public.scan_capture_upload_idempotency force row level security;
revoke all on table public.scan_capture_asset, public.scan_capture_upload_event, public.scan_capture_upload_idempotency from public, anon, authenticated;
create trigger scan_capture_asset_controlled before insert or update or delete on public.scan_capture_asset for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger scan_capture_upload_event_controlled before insert or update or delete on public.scan_capture_upload_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger scan_capture_upload_idempotency_controlled before insert or update or delete on public.scan_capture_upload_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.register_scan_capture_asset(
  p_session_id uuid, p_provider_identity_id uuid, p_asset_id uuid, p_scan_session_id uuid, p_step text,
  p_capture_revision integer, p_object_key text, p_mime_type text, p_byte_size integer, p_checksum text, p_idempotency_key text
) returns table (asset_id uuid, upload_status text, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_session public.scan_session%rowtype; v_existing public.scan_capture_upload_idempotency%rowtype; v_prior public.scan_capture_asset%rowtype;
begin
  if p_step not in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right') or p_mime_type not in ('image/jpeg','image/png','image/webp')
    or p_byte_size not between 1 and 10485760 or p_checksum !~ '^[0-9a-f]{64}$' or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then raise exception using errcode='22023', message='SCAN_MEDIA_INVALID'; end if;
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,p_scan_session_id);
  select * into v_existing from public.scan_capture_upload_idempotency where clinic_id=v_context.clinic_id and actor_platform_user_id=v_context.actor_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.scan_session_id <> p_scan_session_id or v_existing.capture_step <> p_step or v_existing.checksum <> p_checksum or v_existing.byte_size <> p_byte_size or v_existing.mime_type <> p_mime_type or v_existing.capture_revision <> p_capture_revision then
      raise exception using errcode='40001', message='SCAN_MEDIA_IDEMPOTENCY_MISMATCH';
    end if;
    return query select v_existing.scan_capture_asset_id, 'uploaded'::text, false; return;
  end if;
  select * into strict v_session from public.scan_session where id=p_scan_session_id and clinic_id=v_context.clinic_id for update;
  if v_session.status <> 'paired' or not exists (select 1 from public.scan_capture_state cs where cs.scan_session_id=p_scan_session_id and cs.revision=p_capture_revision and cs.current_step=p_step) then raise exception using errcode='42501', message='SCAN_MEDIA_DENIED'; end if;
  if p_object_key !~ ('^clinics/' || v_context.clinic_id::text || '/patients/' || v_session.patient_id::text || '/consultations/' || v_session.consultation_id::text || '/clinical-image-original/' || p_step || '/' || p_asset_id::text || '/v0001/original\.(jpeg|png|webp)$') then raise exception using errcode='42501', message='SCAN_MEDIA_DENIED'; end if;
  perform set_config('graftvision.scan_controlled','on',true);
  select * into v_prior from public.scan_capture_asset a where a.scan_session_id=p_scan_session_id and a.capture_step=p_step and a.upload_status='uploaded' for update;
  if found and coalesce((select (cs.retake_counts ->> p_step)::integer from public.scan_capture_state cs where cs.scan_session_id=p_scan_session_id), 0) < 1 then
    raise exception using errcode='40001', message='SCAN_MEDIA_RETAKE_REQUIRED';
  elsif found then
-- graftvision:dangerous-sql-approved task=SCAN-004
-- graftvision:dangerous-sql-reason Controlled supersession preserves the prior immutable capture asset.
-- graftvision:corrective-plan Forward-fix through an additive migration; no asset is overwritten or deleted.
    update public.scan_capture_asset a set upload_status='superseded' where a.id=v_prior.id;
    insert into public.scan_capture_upload_event(scan_capture_asset_id,clinic_id,event_type,actor_platform_user_id) values(v_prior.id,v_context.clinic_id,'superseded',v_context.actor_id);
    insert into public.audit_event (audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata)
    values ('clinic',v_context.clinic_id,v_context.actor_id,'user','scan_capture.asset_superseded','scan_capture_asset',v_prior.id,'success',p_idempotency_key::uuid,'database',jsonb_build_object('capture_step',p_step));
  end if;
  insert into public.scan_capture_asset(id,clinic_id,patient_id,consultation_id,scan_session_id,capture_step,capture_revision,object_key,mime_type,byte_size,checksum,upload_status,supersedes_asset_id,created_by)
  values(p_asset_id,v_context.clinic_id,v_session.patient_id,v_session.consultation_id,p_scan_session_id,p_step,p_capture_revision,p_object_key,p_mime_type,p_byte_size,p_checksum,'uploaded',v_prior.id,v_context.actor_id);
  insert into public.scan_capture_upload_event(scan_capture_asset_id,clinic_id,event_type,actor_platform_user_id) values(p_asset_id,v_context.clinic_id,'uploaded',v_context.actor_id);
  insert into public.scan_capture_upload_idempotency(clinic_id,actor_platform_user_id,idempotency_key,scan_session_id,scan_capture_asset_id,capture_step,checksum,byte_size,mime_type,capture_revision)
  values(v_context.clinic_id,v_context.actor_id,p_idempotency_key,p_scan_session_id,p_asset_id,p_step,p_checksum,p_byte_size,p_mime_type,p_capture_revision);
  insert into public.audit_event (audit_scope,clinic_id,actor_platform_user_id,actor_type,action,resource_type,resource_id,outcome,request_id,source_application,metadata)
  values ('clinic',v_context.clinic_id,v_context.actor_id,'user','scan_capture.upload_completed','scan_capture_asset',p_asset_id,'success',p_idempotency_key::uuid,'database',jsonb_build_object('capture_step',p_step));
  perform set_config('graftvision.scan_controlled','off',true);
  return query select p_asset_id,'uploaded'::text,true;
end; $$;
revoke all on function graftvision_private.register_scan_capture_asset(uuid,uuid,uuid,uuid,text,integer,text,text,integer,text,text) from public,anon,authenticated;

create function graftvision_private.authorise_scan_capture_upload(
  p_session_id uuid, p_provider_identity_id uuid, p_asset_id uuid, p_scan_session_id uuid, p_step text, p_capture_revision integer, p_mime_type text
) returns table (object_key text)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_session public.scan_session%rowtype; v_extension text;
begin
  if p_step not in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right') or p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception using errcode='22023',message='SCAN_MEDIA_INVALID'; end if;
  select * into strict v_context from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,p_scan_session_id);
  select * into strict v_session from public.scan_session where id=p_scan_session_id and clinic_id=v_context.clinic_id;
  if v_session.status <> 'paired' or not exists(select 1 from public.scan_capture_state cs where cs.scan_session_id=p_scan_session_id and cs.revision=p_capture_revision and cs.current_step=p_step) then raise exception using errcode='42501',message='SCAN_MEDIA_DENIED'; end if;
  v_extension:=case p_mime_type when 'image/jpeg' then 'jpeg' when 'image/png' then 'png' else 'webp' end;
  return query select 'clinics/'||v_context.clinic_id::text||'/patients/'||v_session.patient_id::text||'/consultations/'||v_session.consultation_id::text||'/clinical-image-original/'||p_step||'/'||p_asset_id::text||'/v0001/original.'||v_extension;
end; $$;
revoke all on function graftvision_private.authorise_scan_capture_upload(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change', 'authorization.version_increment',
    'clinic.branding_conflict', 'clinic.branding_update', 'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.onboarding_attest', 'clinic.onboarding_blocked', 'clinic.onboarding_ready', 'clinic.onboarding_reopened', 'clinic.read', 'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update', 'clinic.settings_view', 'clinic.suspend',
    'consultation.concurrency_conflict', 'consultation.create', 'consultation.doctor_assign', 'consultation.doctor_reassign', 'consultation.status_change', 'consultation.complete', 'consultation.reopen',
    'clinical_history.version_create', 'clinical_history.material_amend', 'clinical_history.submit_review', 'clinical_history.doctor_review', 'clinical_history.amendment_request', 'clinical_history.supersede', 'clinical_history.retract',
    'doctor_private_note.create', 'doctor_private_note.amend', 'doctor_private_note.retract', 'doctor_private_note.sensitive_read', 'doctor.verification.expired', 'doctor.verification.pending', 'doctor.verification.rejected', 'doctor.verification.revoked', 'doctor.verification.verified',
    'invitation.accept', 'invitation.create', 'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate', 'membership.read', 'membership.reactivate', 'membership.role_assign', 'membership.role_remove', 'membership.suspend',
    'patient.archive', 'patient.create', 'patient.duplicate_override', 'patient.duplicate_warning', 'patient.privacy_acknowledge', 'patient.privacy_withdraw', 'patient.registration_create', 'patient.restore', 'patient.status_change',
    'platform.admin', 'role.assign', 'role.remove', 'session.create', 'session.deny_inactive_user', 'session.end', 'session.expire_absolute', 'session.expire_idle', 'session.lock', 'session.logout_after_lock', 'session.reauthentication_failed', 'session.revoke_authorization_change', 'session.revoke_inactive_membership', 'session.revoke_inactive_user', 'session.revoke_other', 'session.revoke_others', 'session.unlock',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate', 'preliminary_assessment.version_create', 'preliminary_assessment.doctor_review', 'preliminary_assessment.supersede', 'preliminary_assessment.retract',
    'scan_session.create', 'scan_session.pair', 'scan_session.complete', 'scan_session.revoke', 'scan_session.expire', 'scan_capture.upload_completed', 'scan_capture.asset_superseded', 'scan_capture.preview_accessed'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in ('audit_event','application_session','clinic','clinic_invitation','clinic_membership','clinic_membership_role','consultation','consultation_assignment','clinical_history','doctor_private_note','doctor_verification','patient','patient_privacy_acknowledgement','platform_user','platform_user_role','storage_object_key','system','preliminary_assessment','consultation_lifecycle_event','scan_session','scan_capture_asset');
$$;
